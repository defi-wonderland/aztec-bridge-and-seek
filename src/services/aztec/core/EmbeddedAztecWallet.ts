import {
  getContractInstanceFromInstantiationParams,
} from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { Account, SignerlessAccount } from '@aztec/aztec.js/account';
import { AccountManager, BaseWallet, SimulateOptions, DeployAccountOptions, UserFeeOptions, FeeOptions } from '@aztec/aztec.js/wallet';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { createLogger } from '@aztec/foundation/log';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE, PXE } from '@aztec/pxe/client/lazy';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import {
  getStubAccountContractArtifact,
  createStubAccount,
} from '@aztec/accounts/stub/lazy';
import {
  ExecutionPayload,
  mergeExecutionPayloads,
} from '@aztec/entrypoints/payload';
import { TxSimulationResult } from '@aztec/stdlib/tx';
import { GasSettings } from '@aztec/stdlib/gas';
import {
  AccountFeePaymentMethodOptions,
  DefaultAccountEntrypointOptions,
} from '@aztec/entrypoints/account';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { siloNullifier } from '@aztec/stdlib/hash';
import { type AztecAsyncKVStore } from '@aztec/kv-store';

import { AztecStorageService } from './AztecStorageService';
import { AccountData } from '../../../types/aztec';

const PROVER_ENABLED = true;
const logger = createLogger('embedded-wallet');

export class EmbeddedAztecWallet extends BaseWallet {
  connectedAccount: Account | null = null;
  protected accounts: Map<string, Account> = new Map();
  protected aztecNode: AztecNode;
  private storageService: AztecStorageService;

  private constructor(
    pxe: PXE,
    aztecNode: AztecNode,
    storageService: AztecStorageService
  ) {
    super(pxe, aztecNode);
    this.aztecNode = aztecNode;
    this.storageService = storageService;
  }

  /**
   * Initialize the wallet with PXE and Aztec Node
   * This is the main entry point for creating a wallet instance
   */
  static async initialize(
    nodeUrl: string,
    storageService: AztecStorageService,
    pxeStore?: AztecAsyncKVStore
  ): Promise<EmbeddedAztecWallet> {
    // Create Aztec Node Client
    const aztecNode = createAztecNodeClient(nodeUrl);

    // Create PXE
    const config = getPXEConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;

    const pxe = pxeStore
      ? await createPXE(aztecNode, config, { store: pxeStore, useLogSuffix: false })
      : await createPXE(aztecNode, config, { useLogSuffix: true });

    // Register Sponsored FPC Contract with PXE
    const sponsoredFPCContract = await EmbeddedAztecWallet.getSponsoredFPCContract();
    await pxe.registerContract({
      instance: sponsoredFPCContract.instance,
      artifact: sponsoredFPCContract.artifact,
    });

    // Log the Node Info
    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);

    return new EmbeddedAztecWallet(pxe, aztecNode, storageService);
  }

  /**
   * Get the Sponsored FPC Contract instance for fee payments
   */
  private static async getSponsoredFPCContract() {
    const instance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return {
      instance,
      artifact: SponsoredFPCContractArtifact,
    };
  }

  /**
   * Get account from address, supporting both regular and signerless accounts
   */
  protected async getAccountFromAddress(
    address: AztecAddress
  ): Promise<Account> {
    let account: Account | undefined;
    console.log('account', account)
    // Only use SignerlessAccount for the zero address
    if (address.equals(AztecAddress.ZERO)) {
      const chainInfo = await this.getChainInfo();
      account = new SignerlessAccount(chainInfo);
    } else {
      account = this.accounts.get(address.toString());
    }

    if (!account) {
      throw new Error(`Account not found: ${address.toString()}. Available accounts: ${Array.from(this.accounts.keys()).join(', ')}`);
    }

    return account;
  }

  override async getDefaultFeeOptions(
    from: AztecAddress,
    userFeeOptions: UserFeeOptions | undefined
  ): Promise<FeeOptions> {
    const maxFeesPerGas =
      userFeeOptions?.gasSettings?.maxFeesPerGas ??
      (await this.aztecNode.getCurrentBaseFees()).mul(1 + this.baseFeePadding);

    let walletFeePaymentMethod: SponsoredFeePaymentMethod | undefined;
    let accountFeePaymentMethodOptions: AccountFeePaymentMethodOptions;

    // The transaction does not include a fee payment method, so we set a default
    if (!userFeeOptions?.embeddedPaymentMethodFeePayer) {
      const sponsoredFPCContract =
        await EmbeddedAztecWallet.getSponsoredFPCContract();
      walletFeePaymentMethod = new SponsoredFeePaymentMethod(
        sponsoredFPCContract.instance.address
      );
      accountFeePaymentMethodOptions = AccountFeePaymentMethodOptions.EXTERNAL;
    } else {
      // The transaction includes fee payment method, check if we are the fee payer
      accountFeePaymentMethodOptions = from.equals(
        userFeeOptions.embeddedPaymentMethodFeePayer
      )
        ? AccountFeePaymentMethodOptions.FEE_JUICE_WITH_CLAIM
        : AccountFeePaymentMethodOptions.EXTERNAL;
    }

    const gasSettings: GasSettings = GasSettings.default({
      ...userFeeOptions?.gasSettings,
      maxFeesPerGas,
    });

    this.log.debug('Using L2 gas settings', gasSettings);

    return {
      gasSettings,
      walletFeePaymentMethod,
      accountFeePaymentMethodOptions,
    };
  }

  /**
   * Get all accounts managed by this wallet
   */
  getAccounts() {
    return Promise.resolve(
      Array.from(this.accounts.values()).map((acc) => ({
        alias: '',
        item: acc.getAddress(),
      }))
    );
  }

  /**
   * Get the currently connected account
   */
  getConnectedAccount(): Account | null {
    return this.connectedAccount;
  }

  /**
   * Register an account with the wallet and PXE
   */
  private async registerAccount(accountManager: AccountManager): Promise<void> {
    const instance = accountManager.getInstance();
    const artifact = await accountManager
      .getAccountContract()
      .getContractArtifact();

    await this.registerContract(
      instance,
      artifact,
      accountManager.getSecretKey()
    );
  }

  /**
   * Connect to a test account by index (for development)
   */
  async connectTestAccount(index: number): Promise<AztecAddress> {
    const testAccounts = await getInitialTestAccountsData();
    const accountData = testAccounts[index];

    const accountManager = await AccountManager.create(
      this,
      accountData.secret,
      new SchnorrAccountContract(accountData.signingKey),
      accountData.salt
    );

    await this.registerAccount(accountManager);
    const account = await accountManager.getAccount();

    this.accounts.set(
      accountManager.address.toString(),
      account
    );

    this.connectedAccount = account;
    return this.connectedAccount.getAddress();
  }

  /**
   * Create a new account with deterministic generation
   */
  async createAccountAndConnect(): Promise<AztecAddress> {
    if (!this.pxe) {
      throw new Error('Wallet not initialized: PXE is not available');
    }

    // Generate default credentials from "hola" and "1337"
    const { secretKey, salt, signingKey } =
      await this.generateAccountCredentials('hola', '1337');
    console.log(secretKey.toField().toString(), salt.toString(), signingKey.toString())
    // Create ECDSA R1 account contract
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Create account manager
    const accountManager = await AccountManager.create(
      this,
      secretKey,
      accountContract,
      salt
    );

    // Register with PXE BEFORE deployment (needed for auth witnesses during deployment)
    await this.registerAccount(accountManager);

    // Get account and add to map BEFORE deployment
    const account = await accountManager.getAccount();
    this.accounts.set(
      accountManager.address.toString(),
      account
    );

    // Check if account is already deployed
    const isDeployed = await this.isAccountDeployed(accountManager.address);

    if (isDeployed) {
      logger.info('Account already deployed, skipping deployment', {
        address: accountManager.address.toString(),
      });
    } else {
      // Deploy the account (now it can find itself in the accounts map)
      logger.info('Deploying new account', {
        address: accountManager.address.toString(),
      });
      await this.deployAccountManager(accountManager);
    }

    this.connectedAccount = account;

    // Store in persistent storage
    this.storageService.saveAccount({
      address: accountManager.address.toString(),
      secretKey: secretKey.toString(),
      salt: salt.toString(),
      signingKey: signingKey.toString('hex'),
    });
    console.log({
      address: accountManager.address.toString(),
      secretKey: secretKey.toString(),
      salt: salt.toString(),
      signingKey: signingKey.toString('hex'),
    })

    logger.info('Account created and persisted', {
      address: accountManager.address.toString(),
      type: 'ecdsasecp256r1',
    });

    return this.connectedAccount.getAddress();
  }

  /**
   * Connect to an existing account from storage
   */
  async connectExistingAccount(): Promise<AztecAddress | null> {
    const accountData = this.storageService.getAccount();

    if (!accountData) {
      logger.info('No saved account found in storage');
      return null;
    }

    // Validate storage data
    this.validateAccountData(accountData);

    const secretKey = Fr.fromString(accountData.secretKey);
    const salt = Fr.fromString(accountData.salt);
    const signingKey = Buffer.from(accountData.signingKey, 'hex');

    // Recreate account with ECDSA R1 (default type)
    const accountContract = new EcdsaRAccountContract(signingKey);
    const accountManager = await AccountManager.create(
      this,
      secretKey,
      accountContract,
      salt
    );

    await this.registerAccount(accountManager);
    const account = await accountManager.getAccount();

    this.accounts.set(
      accountManager.address.toString(),
      account
    );

    this.connectedAccount = account;

    logger.info('Connected to existing account', {
      address: accountData.address,
    });

    return this.connectedAccount.getAddress();
  }

  /**
   * Deploy an account manager
   */
  private async deployAccountManager(
    accountManager: AccountManager
  ): Promise<void> {
    const sponsoredFPCContract =
      await EmbeddedAztecWallet.getSponsoredFPCContract();

    const deployOpts: DeployAccountOptions = {
      from: AztecAddress.ZERO,
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(
          sponsoredFPCContract.instance.address
        ),
      },
      skipClassPublication: true,
      skipInstancePublication: true,
    };

    const deployMethod = await accountManager.getDeployMethod();
    const provenInteraction = await deployMethod.prove(deployOpts);
    const receipt = await provenInteraction.send().wait({ timeout: 120 });

    logger.info('Account deployed', {
      status: receipt.status,
      txHash: receipt.txHash?.toString(),
    });
  }

  /**
   * Check if an account is already deployed by checking its initialization nullifier
   */
  async isAccountDeployed(address: AztecAddress): Promise<boolean> {
    const initNullifier = await siloNullifier(address, address.toField());
    const witness = await this.aztecNode.getNullifierMembershipWitness(
      'latest',
      initNullifier
    );
    return !!witness;
  }

  /**
   * Simulate a transaction with stub account support
   */
  async simulateTx(
    executionPayload: ExecutionPayload,
    opts: SimulateOptions
  ): Promise<TxSimulationResult> {
    const feeOptions = opts.fee?.estimateGas
      ? await this.getFeeOptionsForGasEstimation(opts.from, opts.fee)
      : await this.getDefaultFeeOptions(opts.from, opts.fee);

    const feeExecutionPayload =
      await feeOptions.walletFeePaymentMethod?.getExecutionPayload();

    const executionOptions: DefaultAccountEntrypointOptions = {
      txNonce: Fr.random(),
      cancellable: this.cancellableTransactions,
      feePaymentMethodOptions: feeOptions.accountFeePaymentMethodOptions,
    };

    const finalExecutionPayload = feeExecutionPayload
      ? mergeExecutionPayloads([feeExecutionPayload, executionPayload])
      : executionPayload;

    const {
      account: fromAccount,
      instance,
      artifact,
    } = await this.getFakeAccountDataFor(opts.from);

    const txRequest = await fromAccount.createTxExecutionRequest(
      finalExecutionPayload,
      feeOptions.gasSettings,
      executionOptions
    );

    const contractOverrides = {
      [opts.from.toString()]: { instance, artifact },
    };

    console.log(this.pxe)
    return this.pxe.simulateTx(
      txRequest,
      true /* simulatePublic */,
      true,
      true,
      {
        contracts: contractOverrides,
      }
    );
  }

  /**
   * Get account data for simulation purposes
   * Following vanilla box pattern: creates stub account with stub artifact
   */
  private async getFakeAccountDataFor(address: AztecAddress) {
    const chainInfo = await this.getChainInfo();
    const originalAccount = await this.getAccountFromAddress(address);
    const originalAddress = originalAccount.getCompleteAddress();

    // Get the original account's contract instance from PXE
    const { contractInstance } = await this.pxe.getContractMetadata(
      originalAddress.address
    );

    if (!contractInstance) {
      throw new Error(
        `No contract instance found for address: ${originalAddress.address}`
      );
    }

    // Create stub account for simulation (no real signing needed)
    const stubAccount = createStubAccount(originalAddress, chainInfo);

    // Get stub account artifact (standard artifact used for simulations)
    const StubAccountContractArtifact = await getStubAccountContractArtifact();

    // Create a new instance with stub artifact and random salt for simulation
    const instance = await getContractInstanceFromInstantiationParams(
      StubAccountContractArtifact,
      { salt: Fr.random() }
    );

    return {
      account: stubAccount,
      instance,
      artifact: StubAccountContractArtifact,
    };
  }

  /**
   * Generate deterministic account credentials from a secret phrase
   *
   * @param secretPhrase - Secret phrase to derive credentials from (required)
   * @param saltString - Salt string for deterministic address generation (required)
   * @throws Error if secretPhrase or saltString are not provided
   */
  private async generateAccountCredentials(
    secretPhrase: string,
    saltString: string
  ): Promise<{ secretKey: Fr; salt: Fr; signingKey: Buffer }> {
    if (!secretPhrase || !saltString) {
      throw new Error(
        'Both secretPhrase and saltString are required for deterministic account generation'
      );
    }

    // Deterministic generation
    const secretHash = await poseidon2Hash([
      Fr.fromBufferReduce(
        Buffer.from(secretPhrase.padEnd(32, '#'), 'utf8')
      ),
    ]);

    const secretKey = secretHash;
    const salt = Fr.fromString(saltString);
    const signingKey = Buffer.from(secretHash.toBuffer().subarray(0, 32));
    console.log(signingKey)
    return { secretKey, salt, signingKey };
  }

  /**
   * Validate account data from storage
   */
  private validateAccountData(accountData: AccountData): void {
    if (!accountData.address) {
      throw new Error('Storage validation error: address is missing');
    }
    if (!accountData.secretKey) {
      throw new Error('Storage validation error: secretKey is missing');
    }
    if (!accountData.salt) {
      throw new Error('Storage validation error: salt is missing');
    }
    if (!accountData.signingKey) {
      throw new Error('Storage validation error: signingKey is missing');
    }

    // Validate format
    try {
      AztecAddress.fromString(accountData.address);
    } catch {
      throw new Error('Storage validation error: invalid address format');
    }

    try {
      Fr.fromString(accountData.secretKey);
    } catch {
      throw new Error('Storage validation error: invalid secret key format');
    }

    try {
      Fr.fromString(accountData.salt);
    } catch {
      throw new Error('Storage validation error: invalid salt format');
    }

    try {
      Buffer.from(accountData.signingKey, 'hex');
    } catch {
      throw new Error('Storage validation error: invalid signing key format');
    }
  }

  /**
   * Get the sponsored fee payment method
   */
  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    const sponsoredFPCContract =
      await EmbeddedAztecWallet.getSponsoredFPCContract();
    return new SponsoredFeePaymentMethod(
      sponsoredFPCContract.instance.address
    );
  }

  /**
   * Clear the currently connected account (doesn't remove from storage)
   */
  clearConnectedAccount(): void {
    this.connectedAccount = null;
  }

  /**
   * Clear account - Alias for clearConnectedAccount (backward compatibility)
   */
  clearAccount(): void {
    this.clearConnectedAccount();
  }

  /**
   * Create a new account (convenience wrapper for provider compatibility)
   * Uses default ECDSA R1 type
   */
  async createAccount(): Promise<void> {
    await this.createAccountAndConnect();
  }

  /**
   * Deploy the currently connected account
   * Returns transaction hash if deployed, null if already deployed
   */
  async deployAccount(): Promise<string | null> {
    if (!this.connectedAccount) {
      logger.info('No connected account, checking if already deployed in storage');
    }

    // Check if already deployed (if we have a connected account)
    if (this.connectedAccount) {
      const isDeployed = await this.isAccountDeployed(this.connectedAccount.getAddress());
      if (isDeployed) {
        logger.info('Account already deployed', {
          address: this.connectedAccount.getAddress().toString(),
        });
        return null;
      }
    }

    // Try to get credentials from storage, or use defaults
    let accountData = this.storageService.getAccount();
    let secretKey: Fr;
    let salt: Fr;
    let signingKey: Buffer;

    if (!accountData) {
      logger.info('No account in storage, using default credentials from secret phrase "hola"');

      // Generate default credentials from "hola" secret phrase
      const credentials = await this.generateAccountCredentials('hola', '1337');
      secretKey = credentials.secretKey;
      salt = credentials.salt;
      signingKey = credentials.signingKey;

      // Create account contract and manager to get the address
      const accountContract = new EcdsaRAccountContract(signingKey);
      const accountManager = await AccountManager.create(
        this,
        secretKey,
        accountContract,
        salt
      );

      // Save to storage for future use
      this.storageService.saveAccount({
        address: accountManager.address.toString(),
        secretKey: secretKey.toString(),
        salt: salt.toString(),
        signingKey: signingKey.toString('hex'),
      });

      logger.info('Default account credentials saved to storage', {
        address: accountManager.address.toString(),
      });
    } else {
      // Use existing credentials from storage
      logger.info('Using existing account from storage', {
        address: accountData.address,
      });

      secretKey = Fr.fromString(accountData.secretKey);
      salt = Fr.fromString(accountData.salt);
      signingKey = Buffer.from(accountData.signingKey, 'hex');
    }

    // Recreate account contract (assume ECDSA R1 as default)
    const accountContract = new EcdsaRAccountContract(signingKey);
    const accountManager = await AccountManager.create(
      this,
      secretKey,
      accountContract,
      salt
    );

    // Deploy
    await this.deployAccountManager(accountManager);

    logger.info('Account deployed successfully', {
      address: accountManager.address.toString(),
    });

    return null; // We don't return tx hash for now, but could be added
  }

  /**
   * Delete account from both memory and storage
   */
  deleteAccount(address: AztecAddress): void {
    this.accounts.delete(address.toString());

    // Clear storage if it's the stored account
    const storedAccount = this.storageService.getAccount();
    if (storedAccount?.address === address.toString()) {
      this.storageService.clearAccount();
    }

    // Clear connected account if it matches
    if (this.connectedAccount?.getAddress().equals(address)) {
      this.connectedAccount = null;
    }

    logger.info('Account deleted', { address: address.toString() });
  }

  /**
   * Get the underlying PXE instance
   */
  getPXE() {
    return this.pxe;
  }

  /**
   * Get the Aztec Node instance
   */
  getAztecNode(): AztecNode {
    return this.aztecNode;
  }
}

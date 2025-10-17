import {
  Fr,
  createLogger,
  createAztecNodeClient,
  type Wallet,
  AccountManager,
  AztecAddress,
  AztecNode,
  type Aliased,
  Account,
} from '@aztec/aztec.js';
import { type AztecAsyncKVStore } from '@aztec/kv-store';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { EcdsaKAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE, PXE } from '@aztec/pxe/client/lazy';

import { SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { IAztecWalletService, CreateAccountResult, AccountType } from '../../../types';
import { AztecStorageService } from './AztecStorageService';
import { siloNullifier } from '@aztec/stdlib/hash';
// import { getInitialTestAccounts } from '@aztec/accounts/testing';

const PROVER_ENABLED = true;
const logger = createLogger('wallet-service');

export class AztecWalletService implements IAztecWalletService {
  private pxe!: PXE;
  private aztecNode!: AztecNode;
  // private walletDB: AztecWalletDB;
  private storageService: AztecStorageService;
  private accountManager: AccountManager | null = null;
  private connectedWallet: Wallet | null = null;
  private accountCredentials: { secretKey: Fr, salt: Fr, signingKey: Buffer } | null = null;

  constructor(storageService: AztecStorageService) {
    this.storageService = storageService;
  }

  async initialize(nodeUrl: string, pxeStore?: AztecAsyncKVStore): Promise<void> {
    const aztecNode = await createAztecNodeClient(nodeUrl);
    this.aztecNode = aztecNode;

    const config = getPXEConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;

    // Create PXE with persistent store if provided, otherwise use in-memory
    if (pxeStore) {
      this.pxe = await createPXE(aztecNode, config, { store: pxeStore, useLogSuffix: false });
    } else {
      this.pxe = await createPXE(aztecNode, config);
    }

    await this.pxe.registerContract({
      instance: await this.getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // TODO: temporary register the sender so we can see the Substance's WETH balance.
    await this.pxe.registerSender(AztecAddress.fromString('0x26be21c66b2fc789cacb0ab3a178dc6f436a6688a75b4fdfa3c2ca18d44f7cf2'));

    console.log('000')
    console.log(await this.createAccount())
    console.log(this.accountManager?.getSecretKey().toString())
    console.log('AAAAAAAAAAAAAAAAa')
    console.log(this.accountManager?.getAccountContract())
     console.log('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
    console.log(this.accountManager?.getInstance())

    // Log the Node Info
    // const nodeInfo = await this.pxe.();
    logger.info('PXE Connected to node');
  }

  getPXE(): PXE {
    return this.pxe;
  }

  private async getContractInstanceFromDeployParams(artifact: any, params: any) {
    const { getContractInstanceFromInstantiationParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromInstantiationParams(artifact, params);
  }

  private async getSponsoredFPCContract() {
    const instance = await this.getContractInstanceFromDeployParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return instance;
  }

  /**
   * Generate deterministic account credentials from a secret phrase
   * This ensures the same phrase always generates the same account
   */
  private static async getAccountCredentialsFromPhrase(
    secretPhrase?: string,
    saltString?: string
  ): Promise<{ secretKey: Fr, salt: Fr, signingKey: Buffer }> {
    // Use env vars as defaults if not provided
    const DEPLOYER_SECRET_PHRASE = secretPhrase || process.env.DEPLOYER_SECRET_PHRASE || 'hola';
    const DEPLOYER_SALT = saltString || process.env.DEPLOYER_SALT || '1337';

    // Generate deterministic secret using poseidon hash
    const DEPLOYER_SECRET = await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(DEPLOYER_SECRET_PHRASE.padEnd(32, '#'), 'utf8')),
    ]);

    const secretKey = DEPLOYER_SECRET;
    const salt = Fr.fromString(DEPLOYER_SALT);
    const signingKey = Buffer.from(DEPLOYER_SECRET.toBuffer().subarray(0, 32));

    logger.info('Generated account credentials', {
      secretKey: DEPLOYER_SECRET.toString(),
      salt: DEPLOYER_SALT,
      signingKey: signingKey.toString('hex'),
    });

    return { secretKey, salt, signingKey };
  }

  /**
   * Get new account credentials (for backward compatibility)
   */
  private async getNewAccountCredentials(): Promise<{ secretKey: Fr, salt: Fr, signingKey: Buffer }> {
    return AztecWalletService.getAccountCredentialsFromPhrase();
  }

  async connectTestAccount(index: number): Promise<void> {
    // const testAccounts = await getInitialTestAccounts();
    // const account = testAccounts[index];

    // // Use new AccountManager pattern
    // const accountContract = new SchnorrAccountContract(account.signingKey);
    // const accountManager = await AccountManager.create(
    //   this.pxe as any as Wallet,
    //   account.secret,
    //   accountContract,
    //   account.salt
    // );
    // const wallet = await accountManager.getAccount();

    // this.accountManager = accountManager;
    // this.connectedWallet = wallet;
    // this.accountCredentials = { secretKey: account.secret, salt: account.salt, signingKey: account.signingKey.toBuffer() };
  }

  /**
   * Create an account with a specific type
   */
  private async createAccountWithType(
    type: AccountType,
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<void> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    let accountContract: SchnorrAccountContract | EcdsaRAccountContract | EcdsaKAccountContract;

    console.log('creating accoutn with type', type)
    // Create the appropriate account contract based on type
    switch (type) {
      case 'schnorr':
        // SchnorrAccountContract requires an Fq type (not Buffer)
        // For now, only support ECDSA types
        throw new Error('Schnorr accounts not currently supported - use ecdsasecp256r1');
      case 'ecdsasecp256r1':
        accountContract = new EcdsaRAccountContract(signingKey);
        break;
      case 'ecdsasecp256k1':
        accountContract = new EcdsaKAccountContract(signingKey);
        break;
      default:
        throw new Error(`Unsupported account type: ${type}`);
    }

    // Create AccountManager - note: this requires a BaseWallet, not PXE
    // For now, we'll use a workaround by casting PXE to any
    const accountManager = await AccountManager.create(
      this.pxe as any,
      secretKey,
      accountContract,
      salt
    );

    // Get the account from the manager
    
    this.accountManager = accountManager;
    console.log(accountManager.getAccountContract())
    console.log(accountManager.getInstance())
    const deployMethod = await accountManager.getDeployMethod()
    const tx = await deployMethod.send({from: AztecAddress.ZERO})
    console.log('receipt')
    console.log(await tx.getReceipt())
    const receipt = tx.wait()
    console.log((await receipt).txHash)
    // this.connectedWallet = accountManager.getAccountContract()
    const account = await accountManager.getAccount();
    this.connectedWallet = account as any as Wallet;
    this.accountCredentials = { secretKey, salt, signingKey };
  }

  /**
   * Create ECDSA R1 account (for backward compatibility)
   */
  private async createEcdsaAccount(): Promise<void> {
    const { secretKey, salt, signingKey } = await this.getNewAccountCredentials();
    await this.createAccountWithType('ecdsasecp256r1', secretKey, signingKey, salt);
  }

  /**
   * Create account from existing credentials (for backward compatibility)
   */
  private async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<void> {
    await this.createAccountWithType('ecdsasecp256r1', secretKey, signingKey, salt);
  }

  private async performDeployment(): Promise<string | null> {
    if (!this.accountManager) {
      throw new Error('No connected wallet');
    }

    try {
      const paymentMethod = await this.getSponsoredFeePaymentMethod();
      const deployMethod = await this.accountManager.getDeployMethod();
      if (!deployMethod) {
        throw new Error('Failed to get deploy method');
      }
      // const receipt = await this.accountManager.deploy({ fee: { paymentMethod } }).wait({ timeout: 900 });
      // const txHash = receipt.txHash ? receipt.txHash.toString() : null;
      // logger.info('Deployment completed', { status: receipt.status, txHash });
      // return txHash;
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (
        errorMessage.includes('Existing nullifier') ||
        errorMessage.includes('Invalid tx: Existing nullifier')
      ) {
        logger.info('Account already deployed');
        return null; // Success, but no new transaction
      }

      throw error;
    }
  }

  /**
   * Get the SponsoredFeePaymentMethod instance (cached)
   */
  private cachedPaymentMethod: SponsoredFeePaymentMethod | null = null;
  
  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    if (!this.cachedPaymentMethod) {
      const sponsoredFPCContract = await this.getSponsoredFPCContract();
      this.cachedPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCContract.address);
    }
    return this.cachedPaymentMethod;
  }

  // ========================================
  // HIGH-LEVEL ACCOUNT OPERATIONS
  // ========================================

  /**
   * Create a new deterministic account using env vars or provided credentials
   */
  async createAccount(
    alias?: string,
    type: AccountType = 'ecdsasecp256r1',
    secretPhrase?: string,
    saltString?: string
  ): Promise<void> {
    // Generate credentials from phrase
    const { secretKey, salt, signingKey } = await AztecWalletService.getAccountCredentialsFromPhrase(
      secretPhrase,
      saltString
    );
    // console.log(secretKey, salt, signingKey)
    console.log('aaaaaaaaaaaaaaaaaa')
    // Create account with specified type
    await this.createAccountWithType(type, secretKey, signingKey, salt);

    console.log('account created, maybe')

    if (!this.connectedWallet || !this.accountCredentials) {
      throw new Error('No connected wallet or account credentials');
    }

    // Store in AztecStorageService
    const address = this.connectedWallet.getAccounts()[0].address;
    this.storageService.saveAccount({
      address: address.toString(),
      secretKey: secretKey.toString(),
      salt: salt.toString(),
      signingKey: signingKey.toString('hex'),
    });

    logger.info('Account created and persisted', {
      address: address.toString(),
      type,
      alias: alias || 'default-account',
    });
  }

  /**
   * Connect to an existing account from AztecStorageService
   */
  async connectExistingAccount(_addressOrAlias?: string): Promise<void> {
    // try {
    //   // Load account data from storage
    //   const accountData = this.storageService.getAccount();

    //   if (!accountData) {
    //     logger.info('No saved account found in storage');
    //     return;
    //   }

    //   // Recreate account from stored data
    //   const secretKey = Fr.fromString(accountData.secretKey);
    //   const salt = Fr.fromString(accountData.salt);
    //   const signingKey = Buffer.from(accountData.signingKey, 'hex');

    //   await this.createAccountWithType('ecdsasecp256r1', secretKey, signingKey, salt);

    //   logger.info('Connected to existing account', {
    //     address: accountData.address,
    //   });
    // } catch (error) {
    //   logger.warn('Failed to connect existing account', error);
    //   // Don't throw - allow app to continue without connected account
    // }
  }

  /**
   * List all stored accounts (returns single account from AztecStorageService)
   */
  async getAccounts(): Promise<Aliased<AztecAddress>[]> {
    const accountData = this.storageService.getAccount();
    if (!accountData) {
      return [];
    }
    return [{
      alias: 'default-account',
      item: AztecAddress.fromString(accountData.address),
    }];
  }

  /**
   * Switch to a different stored account (no-op for single account)
   */
  async switchAccount(_addressOrAlias: string): Promise<void> {
    await this.connectExistingAccount();
  }

  /**
   * Delete an account from storage
   */
  async deleteAccount(_addressOrAlias: string): Promise<void> {
    this.storageService.clearAccount();

    // Clear the currently connected account
    this.accountManager = null;
    this.connectedWallet = null;
    this.accountCredentials = null;

    logger.info('Account deleted from storage');
  }

  /**
   * Deploy the currently connected account
   */
  async deployAccount(): Promise<string | null> {
    console.log('Deploying account');
    if (!this.accountManager) {
      throw new Error('No account manager');
    }

    const accountInitialized = await this.isInitializationNullifierPublished(this.aztecNode, this.accountManager.address);

    if (accountInitialized) {
      console.log('Account already initialized. Skipping initialization.');
      return null;
    }

    return await this.performDeployment();
  }

  async isInitializationNullifierPublished(node: AztecNode, address: AztecAddress): Promise<boolean> {
    const initNullifier = await siloNullifier(address, address.toField());
    const witness = await node.getNullifierMembershipWitness('latest', initNullifier);
    return !!witness;
  }

  /**
   * Clear the currently connected account (doesn't delete from storage)
   */
  clearAccount(): void {
    this.accountManager = null;
    this.connectedWallet = null;
    this.accountCredentials = null;
  }

  /**
   * Get the WalletDB instance
   */
  // getWalletDB(): AztecWalletDB {
  //   return this.walletDB;
  // }

  /**
   * Get currently connected account
   */
  getConnectedAccount(): Wallet | null {
    return this.connectedWallet || null;
  }
}

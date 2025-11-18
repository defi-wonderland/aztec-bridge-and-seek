import {
  Fr,
  createLogger,
  createAztecNodeClient,
  type PXE,
  AccountWallet,
  AccountManager,
  AztecAddress,
  AccountWalletWithSecretKey,
  AztecNode,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import { getPXEServiceConfig } from '@aztec/pxe/config';
import { createPXEService } from '@aztec/pxe/client/lazy';
import { getInitialTestAccounts } from '@aztec/accounts/testing';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { IAztecWalletService, CreateAccountResult } from '../../../types';
import { AztecStorageService } from './AztecStorageService';
import { siloNullifier } from '@aztec/stdlib/hash';

const PROVER_ENABLED = true;
const logger = createLogger('wallet-service');

export class AztecWalletService implements IAztecWalletService {
  private pxe!: PXE;
  private aztecNode!: AztecNode;
  private storageService: AztecStorageService;
  private accountManager: AccountManager | null = null;
  private connectedWallet: AccountWalletWithSecretKey | null = null;
  private accountCredentials: { secretKey: Fr, salt: Fr, signingKey: Buffer } | null = null;

  constructor(storageService: AztecStorageService) {
    this.storageService = storageService;
  }

  async initialize(nodeUrl: string): Promise<void> {
    const aztecNode = await createAztecNodeClient(nodeUrl);
    this.aztecNode = aztecNode;

    const config = getPXEServiceConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;
    this.pxe = await createPXEService(aztecNode, config);

    await this.pxe.registerContract({
      instance: await this.getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // TODO: temporary register the sender so we can see the Substance's WETH balance.
    await this.pxe.registerSender(AztecAddress.fromString('0x26be21c66b2fc789cacb0ab3a178dc6f436a6688a75b4fdfa3c2ca18d44f7cf2'));

    // Log the Node Info
    const nodeInfo = await this.pxe.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
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

  private async getNewAccountCredentials(secretPhrase?: string): Promise<{ secretKey: Fr, salt: Fr, signingKey: Buffer }> {
    // Generate a random salt, secret key, and signing key
    if (!secretPhrase) {
      throw new Error('Secret phrase is required');
    }
    const DEPLOYER_SALT = process.env.DEPLOYER_SALT || '1337';
    const DEPLOYER_SECRET = await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(secretPhrase.padEnd(32, '#'), 'utf8')),
    ]);
    const secretKey = DEPLOYER_SECRET;
    const salt = Fr.fromString(DEPLOYER_SALT); 
    const signingKey = Buffer.from(DEPLOYER_SECRET.toBuffer().subarray(0, 32));
    console.log({
      secretKey: DEPLOYER_SECRET.toString(),
      salt: DEPLOYER_SALT,
      signingKey: signingKey.toString('hex'),
    })
    return { secretKey, salt, signingKey };
  }

  async connectTestAccount(index: number): Promise<void> {
    const testAccounts = await getInitialTestAccounts();
    const account = testAccounts[index];
    const schnorrAccount = await getSchnorrAccount(this.pxe, account.secret, account.signingKey, account.salt);

    await schnorrAccount.register();
    const wallet = await schnorrAccount.getWallet();
    this.accountManager = schnorrAccount;
    this.connectedWallet = wallet;
    this.accountCredentials = { secretKey: account.secret, salt: account.salt, signingKey: account.signingKey.toBuffer() };
  }

  private async createEcdsaAccount(secretPhrase?: string): Promise<void> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const { secretKey, salt, signingKey } = await this.getNewAccountCredentials(secretPhrase);

    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );
    await ecdsaAccount.register();
    const ecdsaWallet = await ecdsaAccount.getWallet();

    this.accountManager = ecdsaAccount;
    this.connectedWallet = ecdsaWallet;
    this.accountCredentials = { secretKey, salt, signingKey };
  }

  private async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<void> {
    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );

    await ecdsaAccount.register();
    const ecdsaWallet = await ecdsaAccount.getWallet();

    this.accountManager = ecdsaAccount;
    this.connectedWallet = ecdsaWallet;
    this.accountCredentials = { secretKey, salt, signingKey };
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
      const receipt = await this.accountManager.deploy({ fee: { paymentMethod } }).wait({ timeout: 900 });
      const txHash = receipt.txHash ? receipt.txHash.toString() : null;
      logger.info('Deployment completed', { status: receipt.status, txHash });
      return txHash;
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

  async createAccount(secretPhrase?: string): Promise<void> {
    await this.createEcdsaAccount(secretPhrase);
    if (!this.connectedWallet || !this.accountCredentials) {
      throw new Error('No connected wallet or account credentials');
    }
    this.storageService.clearAccount();
    this.storageService.saveAccount({
      address: this.connectedWallet.getAddress().toString(),
      signingKey: this.accountCredentials.signingKey.toString('hex'),
      secretKey: this.accountCredentials.secretKey.toString(),
      salt: this.connectedWallet.salt.toString(),
    });
  }

  async connectExistingAccount(): Promise<void> {
    const storedAccount = this.storageService.getAccount();

    if (!storedAccount) {
      return;
    }
    
    const secretKeyFr = Fr.fromString(storedAccount.secretKey);
    const saltFr = Fr.fromString(storedAccount.salt);
    const signingKeyBuf = Buffer.from(storedAccount.signingKey, 'hex');

    await this.createEcdsaAccountFromCredentials(
      secretKeyFr,
      signingKeyBuf,
      saltFr
    );
  }

  /**
   * Deploy the currently connected account
   */
  async deployAccount(): Promise<string | null> {
    console.log('Deploying account');
    if (!this.accountManager) {
      throw new Error('No account manager');
    }

    const accountInitialized = await this.isInitializationNullifierPublished(this.aztecNode, this.accountManager.getAddress());

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
   * Clear stored account
   */
  clearAccount(): void {
    this.storageService.clearAccount();
    this.accountManager = null;
  }

  /**
   * Get stored account info
   */
  getStoredAccount() {
    return this.storageService.getAccount();
  }

  /**
   * Get storage service instance
   */
  getStorageService(): AztecStorageService {
    return this.storageService;
  }

  getConnectedAccount(): AccountWalletWithSecretKey | null {
    return this.connectedWallet || null;
  }
}

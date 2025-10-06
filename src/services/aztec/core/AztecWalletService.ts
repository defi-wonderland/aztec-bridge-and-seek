import {
  Fr,
  createLogger,
  createAztecNodeClient,
  Account,
  AccountManager,
  AztecAddress,
  AztecNode,
  GrumpkinScalar,
  Wallet,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import { getInitialTestAccountsData } from '@aztec/accounts/testing';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr';
import { getPXEConfig, PXEConfig } from '@aztec/pxe/config';
import { PXE, createPXE } from '@aztec/pxe/server';
// import { getInitialTestAccounts } from '@aztec/accounts/testing';

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
  private connectedWallet: Wallet | null = null;
  private accountCredentials: { secretKey: Fr, salt: Fr, signingKey: Buffer } | null = null;

  constructor(storageService: AztecStorageService) {
    this.storageService = storageService;
  }

  async initialize(nodeUrl: string): Promise<void> {
    const aztecNode = await createAztecNodeClient(nodeUrl);
    this.aztecNode = aztecNode;

    const config = getPXEConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;
    this.pxe = await createPXE(aztecNode, config);

    await this.pxe.registerContract({
      instance: await this.getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // TODO: temporary register the sender so we can see the Substance's WETH balance.
    await this.pxe.registerSender(AztecAddress.fromString('0x26be21c66b2fc789cacb0ab3a178dc6f436a6688a75b4fdfa3c2ca18d44f7cf2'));

    // Log the Node Info
    const nodeInfo = await this.aztecNode.getNodeInfo();
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

  private async getNewAccountCredentials(): Promise<{ secretKey: Fr, salt: Fr, signingKey: Buffer }> {
    // Generate a random salt, secret key, and signing key
    const DEPLOYER_SECRET_PHRASE = process.env.DEPLOYER_SECRET_PHRASE || 'hola';
    const DEPLOYER_SALT = process.env.DEPLOYER_SALT || '1337';
    const DEPLOYER_SECRET = await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(DEPLOYER_SECRET_PHRASE.padEnd(32, '#'), 'utf8')),
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
    // const testAccounts = await getInitialTestAccountsData();
    // const account = testAccounts[index];

    // // Create SchnorrAccountContract instance
    // const accountContract = new SchnorrAccountContract(GrumpkinScalar.fromBuffer(account.signingKey.toBuffer()));

    // const manager = await this.pxe.registerAccount(account.secret, accountContract);
    // const deployMethod = await manager.getDeployMethod();
    // const completeAddress = await manager.getCompleteAddress();


    // // Create AccountManager
    // // const schnorrAccount = await AccountManager.create(this.pxe, account.secret, accountContract, account.salt);

    // // await schnorrAccount.register();
    // // const wallet = await schnorrAccount.getAccount();
    // // this.accountManager = schnorrAccount;
    // this.connectedWallet = wallet;
    // this.accountCredentials = { secretKey: account.secret, salt: account.salt, signingKey: account.signingKey.toBuffer() };
  }

  private async createEcdsaAccount(): Promise<void> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const { secretKey, salt, signingKey } = await this.getNewAccountCredentials();

    // Create EcdsaRAccountContract instance
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Create AccountManager
    const ecdsaAccount = await AccountManager.create(this.pxe.getRegisteredAccounts()[0], secretKey, accountContract, salt);
    await this.pxe.registerAccount(secretKey, (await ecdsaAccount.getCompleteAddress()).partialAddress);
    const ecdsaWallet = await ecdsaAccount.getAccount();

    this.accountManager = ecdsaAccount;
    this.connectedWallet = (ecdsaWallet as unknown as Wallet);
    this.accountCredentials = { secretKey, salt, signingKey };
  }

  private async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<void> {
    // Create EcdsaRAccountContract instance
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Create AccountManager
    const ecdsaAccount = await AccountManager.create(this.pxe.getRegisteredAccounts()[0], secretKey, accountContract, salt);

    await this.pxe.registerAccount(secretKey, (await ecdsaAccount.getCompleteAddress()).partialAddress);
    const ecdsaWallet = await ecdsaAccount.getAccount();

    this.accountManager = ecdsaAccount;
    this.connectedWallet = (ecdsaWallet as unknown as Wallet);
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
      const sender = this.connectedWallet?.getAccounts()[0].address;
      if (!sender) {
        throw new Error('No connected wallet');
      }
      const receipt = await deployMethod.send({ fee: { paymentMethod }, from: sender })
        .wait({ timeout: 900 });
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

  async createAccount(): Promise<void> {
    await this.createEcdsaAccount();
    if (!this.connectedWallet || !this.accountCredentials) {
      throw new Error('No connected wallet or account credentials');
    }
    this.storageService.clearAccount();
    this.storageService.saveAccount({
      address: this.connectedWallet.getAccounts()[0].address.toString(),
      signingKey: this.accountCredentials.signingKey.toString('hex'),
      secretKey: this.accountCredentials.secretKey.toString(),
      salt: this.accountCredentials.salt.toString(),
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

  getConnectedAccount(): Wallet | null {
    return this.connectedWallet || null;
  }
}

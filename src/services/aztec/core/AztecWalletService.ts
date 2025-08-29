import {
  Fr,
  createLogger,
  createAztecNodeClient,
  type PXE,
  AccountWallet,
  AccountManager,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { randomBytes } from '@aztec/foundation/crypto';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import { getPXEServiceConfig } from '@aztec/pxe/config';
import { createPXEService } from '@aztec/pxe/client/lazy';
import { getInitialTestAccounts } from '@aztec/accounts/testing';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { IAztecWalletService, CreateAccountResult } from '../../../types';
import { AztecStorageService } from './AztecStorageService';

const PROVER_ENABLED = true;
const logger = createLogger('wallet-service');

export interface DeploymentCallbacks {
  onSuccess?: (txHash: string | null) => void;
  onError?: (error: string) => void;
}

export class AztecWalletService implements IAztecWalletService {
  private pxe!: PXE;
  private storageService: AztecStorageService;
  private connectedWallet: AccountWallet | null = null;

  constructor(storageService: AztecStorageService) {
    this.storageService = storageService;
  }

  async initialize(nodeUrl: string): Promise<void> {
    const aztecNode = await createAztecNodeClient(nodeUrl);

    const config = getPXEServiceConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;
    this.pxe = await createPXEService(aztecNode, config);

    await this.pxe.registerContract({
      instance: await this.getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    const nodeInfo = await this.pxe.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
  }

  getPXE(): PXE {
    return this.pxe;
  }

  private async getContractInstanceFromDeployParams(artifact: any, params: any) {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(artifact, params);
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

  async connectTestAccount(index: number): Promise<AccountWallet> {
    const testAccounts = await getInitialTestAccounts();
    const account = testAccounts[index];
    const schnorrAccount = await getSchnorrAccount(this.pxe, account.secret, account.signingKey, account.salt);

    await schnorrAccount.register();
    const wallet = await schnorrAccount.getWallet();
    this.connectedWallet = wallet;

    return wallet;
  }

  private async createEcdsaAccount(): Promise<CreateAccountResult> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const salt = Fr.random();
    const secretKey = Fr.random();
    const signingKey = randomBytes(32);

    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );

    const ecdsaWallet = await ecdsaAccount.getWallet();

    await ecdsaAccount.register();
    this.connectedWallet = ecdsaWallet;

    return {
      account: ecdsaAccount,
      wallet: ecdsaWallet,
      salt,
      secretKey,
      signingKey,
    };
  }

  private async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<{ account: AccountManager; wallet: AccountWallet }> {
    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );

    await this.ensureAccountRegistered(ecdsaAccount);
    
    const ecdsaWallet = await ecdsaAccount.getWallet();
    this.connectedWallet = ecdsaWallet;

    return { account: ecdsaAccount, wallet: ecdsaWallet };
  }

  private async performDeployment(result: CreateAccountResult): Promise<string | null> {
    try {
      await this.ensureAccountRegistered(result.account);
      const paymentMethod = await this.getSponsoredFeePaymentMethod();
      const deployMethod = await result.account?.getDeployMethod();
      if (!deployMethod) {
        throw new Error('Failed to get deploy method');
      }
      const provenInteraction = await deployMethod.prove({
        contractAddressSalt: result.salt,
        fee: { paymentMethod },
        universalDeploy: true,
        skipClassRegistration: true,
        skipPublicDeployment: true,
      });
      const receipt = await provenInteraction.send().wait({ timeout: 120 });
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

  private async ensureAccountRegistered(account?: AccountManager): Promise<void> {
    if (!account) return;
    try {
      await account.register();
      logger.info('Account registered with PXE', account.getAddress().toString());
    } catch (err) {
      logger.warn('Account registration with PXE failed (may already be registered)', err);
    }
  }

  /**
   * Get the SponsoredFeePaymentMethod instance (cached)
   */
  private cachedPaymentMethod: SponsoredFeePaymentMethod | null = null;
  
  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    if (!this.cachedPaymentMethod) {
      const sponsoredPFCContract = await this.getSponsoredFPCContract();
      this.cachedPaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
    }
    return this.cachedPaymentMethod;
  }

  // ========================================
  // HIGH-LEVEL ACCOUNT OPERATIONS
  // ========================================

  async createAccount(): Promise<AccountWallet> {
    const result = await this.createEcdsaAccount();
    this.storageService.clearAccount();
    this.storageService.saveAccount({
      address: result.wallet.getAddress().toString(),
      signingKey: result.signingKey.toString('hex'),
      secretKey: result.secretKey.toString(),
      salt: result.salt.toString(),
    });
    await this.performDeployment(result);

    return result.wallet;
  }

  async connectExistingAccount(): Promise<AccountWallet | null> {
    const account = this.storageService.getAccount();
    if (!account) {
      return null;
    }
    const secretKeyFr = Fr.fromString(account.secretKey);
    const saltFr = Fr.fromString(account.salt);
    const signingKeyBuf = Buffer.from(account.signingKey, 'hex');

    const { account: ecdsaAccount, wallet } = await this.createEcdsaAccountFromCredentials(
      secretKeyFr,
      signingKeyBuf,
      saltFr
    );
    const result: CreateAccountResult = {
      account: ecdsaAccount,
      wallet,
      salt: saltFr,
      secretKey: secretKeyFr,
      signingKey: signingKeyBuf,
    };
    await this.performDeployment(result);

    return wallet;
  }

  /**
   * Clear stored account
   */
  clearAccount(): void {
    this.storageService.clearAccount();
    this.connectedWallet = null;
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

  getConnectedAccount(): AccountWallet | null {
    return this.connectedWallet;
  }
}

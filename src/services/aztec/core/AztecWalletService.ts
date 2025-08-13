import {
  Fr,
  createLogger,
  createAztecNodeClient,
  type PXE,
  AccountWallet,
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

const PROVER_ENABLED = true;
const logger = createLogger('wallet-service');

/**
 * Core service for Aztec wallet operations
 */
export class AztecWalletService {
  private pxe!: PXE;

  /**
   * Initialize PXE service and connect to Aztec node
   */
  async initialize(nodeUrl: string): Promise<void> {
    // Create Aztec Node Client
    const aztecNode = await createAztecNodeClient(nodeUrl);

    // Create PXE Service
    const config = getPXEServiceConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = PROVER_ENABLED;
    this.pxe = await createPXEService(aztecNode, config);

    // Register Sponsored FPC Contract with PXE
    await this.pxe.registerContract({
      instance: await this.#getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // Log the Node Info
    const nodeInfo = await this.pxe.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
  }

  /**
   * Get the PXE instance
   */
  getPXE(): PXE {
    return this.pxe;
  }

  /**
   * Internal method to get the Sponsored FPC Contract for fee payment
   */
  async #getSponsoredPFCContract() {
    const instance = await this.#getContractInstanceFromDeployParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return instance;
  }

  /**
   * Helper method to create contract instance from deploy params
   */
  async #getContractInstanceFromDeployParams(artifact: any, params: any) {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(artifact, params);
  }

  /**
   * Connect to a test account
   */
  async connectTestAccount(index: number): Promise<AccountWallet> {
    const testAccounts = await getInitialTestAccounts();
    const account = testAccounts[index];
    const schnorrAccount = await getSchnorrAccount(this.pxe, account.secret, account.signingKey, account.salt);

    await schnorrAccount.register();
    const wallet = await schnorrAccount.getWallet();

    return wallet;
  }

  /**
   * Create a new ECDSA account
   */
  async createEcdsaAccount(): Promise<{
    account: any;
    wallet: AccountWallet;
    salt: Fr;
    secretKey: Fr;
    signingKey: Buffer;
  }> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    // Generate a random salt, secret key, and signing key
    const salt = Fr.random();
    const secretKey = Fr.random();
    const signingKey = randomBytes(32);

    // Create an ECDSA account
    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );

    // Deploy the account
    const deployMethod = await ecdsaAccount.getDeployMethod();
    const deployOpts = {
      contractAddressSalt: Fr.fromString(ecdsaAccount.salt.toString()),
      fee: {
        paymentMethod: await ecdsaAccount.getSelfPaymentMethod(
          await this.getSponsoredFeePaymentMethod()
        ),
      },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true,
    };

    const provenInteraction = await deployMethod.prove(deployOpts);
    const receipt = await provenInteraction.send().wait({ timeout: 120 });

    logger.info('Account deployed', receipt);

    // Get the wallet
    const ecdsaWallet = await ecdsaAccount.getWallet();

    // Register the account with PXE
    await ecdsaAccount.register();

    return {
      account: ecdsaAccount,
      wallet: ecdsaWallet,
      salt,
      secretKey,
      signingKey,
    };
  }

  /**
   * Create an ECDSA account from existing credentials
   */
  async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<AccountWallet> {
    const ecdsaAccount = await getEcdsaRAccount(
      this.pxe,
      secretKey,
      signingKey,
      salt
    );

    await ecdsaAccount.register();
    const ecdsaWallet = await ecdsaAccount.getWallet();

    return ecdsaWallet;
  }

  /**
   * Get the Sponsored FPC Contract for fee payment
   */
  async getSponsoredPFCContract() {
    return await this.#getSponsoredPFCContract();
  }

  /**
   * Get the SponsoredFeePaymentMethod instance (cached)
   */
  private cachedPaymentMethod: SponsoredFeePaymentMethod | null = null;
  
  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    if (!this.cachedPaymentMethod) {
      const sponsoredPFCContract = await this.#getSponsoredPFCContract();
      this.cachedPaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
    }
    return this.cachedPaymentMethod;
  }
}

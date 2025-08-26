import { type PXE, Fr, SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';
import { AccountDeployWorkerClient } from '../../../workers/accountDeployClient';
import type { CreateAccountResult } from '../../../types';

export interface DeploymentCallbacks {
  onSuccess?: (txHash: string | null) => void;
  onError?: (error: string) => void;
}

export interface AccountCredentials {
  secretKey: string;
  signingKey: string;
  salt: string;
}

/**
 * Service for handling Aztec account deployment operations
 * Focuses solely on deployment business logic
 */
export class AztecAccountDeployService {
  private deployWorker: AccountDeployWorkerClient | null = null;

  constructor(private pxe: PXE) {}

  /**
   * Deploy a new account in the background using a Web Worker
   */
  async deployNewAccount(
    result: CreateAccountResult,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // 1. Prepare everything in service (business logic)
    const account = await this.prepareAccount(result);
    const deployMethod = await account.getDeployMethod();
    const paymentMethod = await this.preparePaymentMethod(account);
    
    // 2. Create account deployment function with all the logic
    const deployAccount = async () => {
      const interaction = await deployMethod.prove({
        contractAddressSalt: result.salt,
        fee: { paymentMethod },
        universalDeploy: true,
        skipClassRegistration: true,
        skipPublicDeployment: true,
      });
      
      return await interaction.send().wait({ timeout: 120 });
    };

    // 3. Send deployment function to worker (worker has no idea what it's executing)
    this.deployAccount(deployAccount, callbacks);
  }

  /**
   * Deploy an existing account in the background using a Web Worker
   */
  async deployExistingAccount(
    credentials: AccountCredentials,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // 1. Prepare everything in service (business logic)
    const account = await this.prepareAccountFromCredentials(credentials);
    const deployMethod = await account.getDeployMethod();
    const paymentMethod = await this.preparePaymentMethod(account);
    
    // 2. Create account deployment function with all the logic
    const deployAccount = async () => {
      const interaction = await deployMethod.prove({
        contractAddressSalt: Fr.fromString(credentials.salt),
        fee: { paymentMethod },
        universalDeploy: true,
        skipClassRegistration: true,
        skipPublicDeployment: true,
      });
      
      return await interaction.send().wait({ timeout: 120 });
    };

    // 3. Send deployment function to worker (worker has no idea what it's executing)
    this.deployAccount(deployAccount, callbacks);
  }

  /**
   * Core deployment logic - handles the actual deployment via worker
   */
  private async deployAccount(
    deployAccount: () => Promise<any>,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // Spawn worker client once per service lifecycle
    if (!this.deployWorker) {
      this.deployWorker = new AccountDeployWorkerClient();
    }

    // Deploy the account via worker, non-blocking
    this.deployWorker.deploy(
      {
        deployAccount: deployAccount,
      },
      {
        onSuccess: (data) => {
          const txHash = data.payload.txHash;
          callbacks?.onSuccess?.(txHash);
        },
        onError: (errMessage) => {
          callbacks?.onError?.(errMessage);
        },
      }
    );
  }

  private async prepareAccount(result: CreateAccountResult) {
    const account = await getEcdsaRAccount(
      this.pxe,
      result.secretKey,
      result.signingKey,
      result.salt
    );
    
    try {
      await account.register();
    } catch (err) {
      if (!err.message.includes('already registered')) {
        throw err;
      }
    }
    
    return account;
  }

  private async prepareAccountFromCredentials(credentials: AccountCredentials) {
    const account = await getEcdsaRAccount(
      this.pxe,
      Fr.fromString(credentials.secretKey),
      Buffer.from(credentials.signingKey, 'hex'),
      Fr.fromString(credentials.salt)
    );
    
    try {
      await account.register();
    } catch (err) {
      if (!err.message.includes('already registered')) {
        throw err;
      }
    }
    
    return account;
  }

  private async preparePaymentMethod(account: any) {
    const sponsoredPFC = await this.getSponsoredPFCContract();
    return await account.getSelfPaymentMethod(
      new SponsoredFeePaymentMethod(sponsoredPFC.address)
    );
  }

  private async getSponsoredPFCContract() {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(
      SponsoredFPCContractArtifact,
      { salt: new Fr(SPONSORED_FPC_SALT) }
    );
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.deployWorker) {
      this.deployWorker = null;
    }
  }
}

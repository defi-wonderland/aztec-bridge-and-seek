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
    const account = await this.prepareAccount(result);
    await this.deployAccountInternal(account, result.salt, callbacks);
  }

  /**
   * Deploy an existing account in the background using a Web Worker
   */
  async deployExistingAccount(
    credentials: AccountCredentials,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    const account = await this.prepareAccountFromCredentials(credentials);
    await this.deployAccountInternal(account, Fr.fromString(credentials.salt), callbacks);
  }

  /**
   * Internal deployment logic shared between new and existing account deployments
   */
  private async deployAccountInternal(
    account: any,
    salt: string | Fr,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    const deployMethod = await account.getDeployMethod();
    const paymentMethod = await this.preparePaymentMethod(account);
    
    const deploymentFunction = async () => {
      const interaction = await deployMethod.prove({
        contractAddressSalt: salt,
        fee: { paymentMethod },
        universalDeploy: true,
        skipClassRegistration: true,
        skipPublicDeployment: true,
      });
      
      return await interaction.send().wait({ timeout: 120 }); // TODO: move timeout to config by network
    };

    await this.executeDeploymentInWorker(deploymentFunction, callbacks);
  }

  /**
   * Core deployment logic - handles the actual deployment via worker
   */
  private async executeDeploymentInWorker(
    deploymentFunction: () => Promise<any>,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // Spawn worker client once per service lifecycle
    if (!this.deployWorker) {
      this.deployWorker = new AccountDeployWorkerClient();
    }

    // Deploy the account via worker, non-blocking
    this.deployWorker.deploy(
      {
        deployAccount: deploymentFunction,
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

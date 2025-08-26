import { type PXE, Fr } from '@aztec/aztec.js';
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
    await this.deployAccountInternal(result, callbacks);
  }

  /**
   * Deploy an existing account in the background using a Web Worker
   */
  async deployExistingAccount(
    credentials: AccountCredentials,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // Convert credentials to CreateAccountResult format
    const result: CreateAccountResult = {
      account: null, // Not needed for deployment
      wallet: null as any, // Not needed for deployment
      salt: Fr.fromString(credentials.salt),
      secretKey: Fr.fromString(credentials.secretKey),
      signingKey: Buffer.from(credentials.signingKey, 'hex'),
    };
    await this.deployAccountInternal(result, callbacks);
  }

  /**
   * Internal deployment logic shared between new and existing account deployments
   */
  private async deployAccountInternal(
    result: CreateAccountResult,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // The worker will handle the full deployment process
    await this.executeDeploymentInWorker(result, callbacks);
  }

  /**
   * Core deployment logic - handles the actual deployment via worker
   */
  private async executeDeploymentInWorker(
    result: CreateAccountResult,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // Spawn worker client once per service lifecycle
    if (!this.deployWorker) {
      this.deployWorker = new AccountDeployWorkerClient();
    }

    // Get the node URL from the PXE
    const nodeUrl = (this.pxe as any).url || 'http://localhost:8080';

    // Deploy the account via worker, non-blocking
    this.deployWorker.deploy(
      {
        nodeUrl,
        secretKey: result.secretKey.toString(),
        signingKeyHex: result.signingKey.toString('hex'),
        salt: result.salt.toString(),
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

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.deployWorker) {
      this.deployWorker = null;
    }
  }
}

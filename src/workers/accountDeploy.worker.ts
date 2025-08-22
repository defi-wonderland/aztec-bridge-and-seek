/// <reference lib="webworker" />

import { Buffer } from 'buffer';
import { Fr, createAztecNodeClient, SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';
import { getPXEServiceConfig } from '@aztec/pxe/config';
import { createPXEService } from '@aztec/pxe/client/lazy';

import type { WorkerRequest, WorkerResponse } from './messages';

declare const self: DedicatedWorkerGlobalScope;

async function getSponsoredPFCContract() {
  const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
  return await getContractInstanceFromDeployParams(SponsoredFPCContractArtifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
}

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as WorkerRequest;
  if (!msg || msg.type !== 'deployEcdsaAccount') return;

  try {
    const { nodeUrl, secretKey, signingKeyHex, salt } = msg.payload;

    const aztecNode = await createAztecNodeClient(nodeUrl);
    const config = getPXEServiceConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = true;
    const pxe = await createPXEService(aztecNode, config);

    await pxe.registerContract({
      instance: await getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    const secretFr = Fr.fromString(secretKey);
    const saltFr = Fr.fromString(salt);
    const signingKey = Buffer.from(signingKeyHex, 'hex');

    const ecdsaAccount = await getEcdsaRAccount(pxe, secretFr, signingKey, saltFr);
    try {
      await ecdsaAccount.register();
    } catch (_) {
      // ignore if already registered
    }

    const deployMethod = await ecdsaAccount.getDeployMethod();
    const sponsoredPFC = await getSponsoredPFCContract();
    const paymentMethod = await ecdsaAccount.getSelfPaymentMethod(new SponsoredFeePaymentMethod(sponsoredPFC.address));

    try {
      const provenInteraction = await deployMethod.prove({
        contractAddressSalt: saltFr,
        fee: { paymentMethod },
        universalDeploy: true,
        skipClassRegistration: true,
        skipPublicDeployment: true,
      });
      const receipt = await provenInteraction.send().wait({ timeout: 120 });

      const response: WorkerResponse = {
        type: 'deployed',
        payload: {
          status: String(receipt.status),
          txHash: receipt.txHash ? receipt.txHash.toString() : null,
        },
      };
      self.postMessage(response);
    } catch (deployError) {
      const deployMessage = deployError instanceof Error ? deployError.message : String(deployError);
      
      // Check if the error is due to account already being deployed
      if (deployMessage.includes('Existing nullifier') || deployMessage.includes('Invalid tx: Existing nullifier')) {
        // Account is already deployed, ensure it's properly synced with PXE
        try {
          // Wait for the account to be ready for use
          await ecdsaAccount.getCompleteAddress();
          
          // Ensure the account is properly synchronized
          const accountWallet = await ecdsaAccount.getWallet();
          await accountWallet.getAddress();
          
          const response: WorkerResponse = {
            type: 'deployed',
            payload: {
              status: 'success',
              txHash: null,
            },
          };
          self.postMessage(response);
        } catch (syncError) {
          // If we can't sync the account, treat as an error
          const syncMessage = syncError instanceof Error ? syncError.message : String(syncError);
          throw new Error(`Account already deployed but failed to sync: ${syncMessage}`);
        }
      } else {
        // Re-throw other deployment errors
        throw deployError;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = { type: 'error', error: message };
    self.postMessage(response);
  }
});



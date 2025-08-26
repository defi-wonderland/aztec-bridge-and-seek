import { Buffer } from 'buffer';
import {
  Fr,
  createPXEClient,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';

import type { WorkerResponse, DeploymentParams } from './messages';

export async function getSponsoredPFCContract() {
  const { getContractInstanceFromDeployParams } = await import(
    '@aztec/aztec.js'
  );
  return await getContractInstanceFromDeployParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );
}

export async function preparePXE(nodeUrl: string) {
  const pxe = createPXEClient(nodeUrl);
  
  await pxe.registerContract({
    instance: await getSponsoredPFCContract(),
    artifact: SponsoredFPCContractArtifact,
  });
  
  return pxe;
}

export async function prepareAccount(pxe: any, params: DeploymentParams) {
  const secretKeyStr = String(params.secretKey);
  const saltStr = String(params.salt);
  const signingKeyHexStr = String(params.signingKeyHex);
  
  const secretFr = Fr.fromString(secretKeyStr);
  const saltFr = Fr.fromString(saltStr);
  const signingKey = Buffer.from(signingKeyHexStr, 'hex');

  const ecdsaAccount = await getEcdsaRAccount(
    pxe,
    secretFr,
    signingKey,
    saltFr
  );
  
  return { account: ecdsaAccount, saltFr };
}

export async function registerAccount(account: any) {
  try {
    await account.register();
    console.log('✅ Account registered with worker PXE');
  } catch (registerError) {
    console.warn('⚠️ Account registration with worker PXE failed (may already be registered)', registerError);
    // Continue with deployment even if registration fails
  }
}

export async function preparePaymentMethod(account: any) {
  const sponsoredPFC = await getSponsoredPFCContract();
  return await account.getSelfPaymentMethod(
    new SponsoredFeePaymentMethod(sponsoredPFC.address)
  );
}

export async function deployAccount(account: any, saltFr: Fr, paymentMethod: any) {
  const deployMethod = await account.getDeployMethod();
  
  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: saltFr,
    fee: { paymentMethod },
    universalDeploy: true,
    skipClassRegistration: true,
    skipPublicDeployment: true,
  });
  
  return await provenInteraction.send().wait({ timeout: 120 });
}

export function handleDeploymentError(error: any): WorkerResponse | null {
  const deployMessage = error instanceof Error ? error.message : String(error);

  // Check if the error is due to account already being deployed
  if (
    deployMessage.includes('Existing nullifier') ||
    deployMessage.includes('Invalid tx: Existing nullifier')
  ) {
    return {
      type: 'deployed',
      payload: {
        status: 'success',
        txHash: null,
      },
    };
  }
  
  return null; // Let the main error handler deal with it
}

export async function deployEcdsaAccount(params: DeploymentParams): Promise<WorkerResponse> {
  const pxe = await preparePXE(params.nodeUrl);
  const { account, saltFr } = await prepareAccount(pxe, params);
  
  await registerAccount(account);
  const paymentMethod = await preparePaymentMethod(account);
  
  try {
    const receipt = await deployAccount(account, saltFr, paymentMethod);
    
    return {
      type: 'deployed',
      payload: {
        status: String(receipt.status),
        txHash: receipt.txHash ? receipt.txHash.toString() : null,
      },
    };
  } catch (deployError) {
    const existingAccountResponse = handleDeploymentError(deployError);
    if (existingAccountResponse) {
      return existingAccountResponse;
    }
    throw deployError;
  }
}

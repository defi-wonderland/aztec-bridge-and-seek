/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse } from './messages';
import { deployEcdsaAccount } from './accountDeployLogic';

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as WorkerRequest;
  if (!msg || msg.type !== 'deployEcdsaAccount') return;

  try {
    console.log('🔧 Worker received:', { 
      nodeUrl: !!msg.payload.nodeUrl, 
      secretKey: typeof msg.payload.secretKey, 
      signingKeyHex: typeof msg.payload.signingKeyHex, 
      salt: typeof msg.payload.salt 
    });

    const response = await deployEcdsaAccount(msg.payload);
    self.postMessage(response);
  } catch (error) {
    console.error('❌ Worker deployment error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = { type: 'error', error: `Worker error: ${message}` };
    self.postMessage(response);
  }
});

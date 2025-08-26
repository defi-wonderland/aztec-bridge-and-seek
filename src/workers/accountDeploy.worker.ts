/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse } from './messages';

declare const self: DedicatedWorkerGlobalScope;

/**
 * Worker: Pure execution engine
 * Receives account deployment function and runs it
 * NO logic, NO decisions, NO configuration
 */
self.addEventListener('message', async (event: MessageEvent) => {
  const { deployAccount } = event.data.payload;
  
  try {
    // Run the account deployment function (worker has no idea what it does)
    const result = await deployAccount();
    
    // Return the deployment result
    self.postMessage({
      type: 'deployed',
      payload: {
        status: String(result.status),
        txHash: result.txHash ? result.txHash.toString() : null,
      }
    });
  } catch (error) {
    // Return any deployment errors
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
});

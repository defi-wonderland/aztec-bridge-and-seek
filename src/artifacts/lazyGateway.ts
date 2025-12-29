/**
 * Lazy loader for AztecGateway7683 artifact and contract.
 * Prevents the app from crashing if the artifact is incompatible.
 */

let gatewayModule: any = null;
let loadAttempted = false;

async function loadModule(): Promise<any> {
  if (gatewayModule) return gatewayModule;
  if (loadAttempted) return null;

  loadAttempted = true;

  try {
    gatewayModule = await import('./AztecGateway7683.js');
    return gatewayModule;
  } catch (error) {
    console.warn(
      '[AztecGateway] Artifact not compatible with current Aztec version:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function getAztecGatewayArtifact(): Promise<any | null> {
  const module = await loadModule();
  return module?.AztecGateway7683Contract?.artifact ?? null;
}

export async function getAztecGatewayContractClass(): Promise<any | null> {
  const module = await loadModule();
  return module?.AztecGateway7683Contract ?? null;
}

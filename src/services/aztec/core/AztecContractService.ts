import {
  AztecAddress,
  Fr,
  type PXE,
} from '@aztec/aztec.js';
import {
  type ContractArtifact,
  getDefaultInitializer,
} from '@aztec/stdlib/abi';

/**
 * Service for managing Aztec contract operations
 */
export class AztecContractService {
  constructor(private pxe: PXE) {}

  /**
   * Register a contract with PXE
   */
  async registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs: any[]
  ): Promise<void> {
    const instance = await this.#getContractInstanceFromDeployParams(artifact, {
      constructorArtifact: getDefaultInitializer(artifact),
      constructorArgs: constructorArgs,
      deployer: deployer,
      salt: deploymentSalt,
    });

    await this.pxe.registerContract({
      instance,
      artifact,
    });
  }

  /**
   * Helper method to create contract instance from deploy params
   */
  async #getContractInstanceFromDeployParams(artifact: ContractArtifact, params: any) {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(artifact, params);
  }
}

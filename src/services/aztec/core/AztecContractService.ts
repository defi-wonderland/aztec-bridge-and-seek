import {
  AztecAddress,
  ContractInstanceWithAddress,
  Fr,
  type PXE,
} from '@aztec/aztec.js';
import {
  type ContractArtifact,
  FunctionAbi,
  getDefaultInitializer,
} from '@aztec/stdlib/abi';
import { IAztecContractService } from '../../../types';

/**
 * Service for managing Aztec contract operations
 */
export class AztecContractService implements IAztecContractService {
  constructor(private pxe: PXE) {}

  /**
   * Register a contract with PXE
   */
  async registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs: any[],
    constructor: FunctionAbi | string
  ): Promise<ContractInstanceWithAddress> {
    const instance = await this.#getContractInstanceFromDeployParams(artifact, {
      constructor: constructor,
      constructorArgs: constructorArgs,
      deployer: deployer,
      salt: deploymentSalt,
    });

    await this.pxe.registerContract({
      instance,
      artifact,
    });

    return instance
  }


  // TODO: We could define a type for this function
  /**
   * Helper method to create contract instance from deploy params
   */
  async #getContractInstanceFromDeployParams(artifact: ContractArtifact, params: {
    deployer?: AztecAddress,
    salt: Fr,
    constructorArgs: any[],
    constructor: FunctionAbi | string
  }) {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(artifact, {
      constructorArgs: params.constructorArgs,
      salt: params.salt,
      constructorArtifact: params.constructor,
      deployer: params.deployer,
    });
  }
}

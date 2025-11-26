import { createLogger } from '@aztec/foundation/log';
import {
  getContractInstanceFromInstantiationParams,
  ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { type AztecNode } from '@aztec/aztec.js/node';

import { DripperContractArtifact } from '../../../artifacts/Dripper.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { TokenContractArtifact as WonderTokenContractArtifact } from '../../../artifacts/Token.js';
import { AztecGateway7683Contract } from '../../../artifacts/AztecGateway7683.js';
import { BRIDGE_CONFIG } from '../../../config/networks/devnet';
import { AppConfig } from '../../../config/networks';
import { TabType } from '../../../types';
import { EmbeddedAztecWallet } from './EmbeddedAztecWallet';

const logger = createLogger('contract-registry');

export const ContractGroups = {
  Dripper: 'Dripper',
  WonderToken: 'WonderToken',
  BridgeToken: 'BridgeToken',
  AztecGateway: 'AztecGateway',
} as const;

export type ContractGroup =
  (typeof ContractGroups)[keyof typeof ContractGroups];

const TAB_CONTRACT_MAP: Record<TabType, ContractGroup[]> = {
  mint: [ContractGroups.Dripper, ContractGroups.WonderToken],
  bridge: [ContractGroups.AztecGateway, ContractGroups.BridgeToken],
  settings: [],
  senders: [],
  info: [ContractGroups.WonderToken, ContractGroups.BridgeToken],
};

export class ContractRegistryService {
  private registeredContracts: Set<ContractGroup> = new Set();
  private registrationInProgress: Map<ContractGroup, Promise<void>> = new Map();
  private wallet: EmbeddedAztecWallet | null = null;
  private aztecNode: AztecNode | null = null;
  private config: AppConfig | null = null;

  initialize(
    wallet: EmbeddedAztecWallet,
    aztecNode: AztecNode,
    config: AppConfig
  ): void {
    this.wallet = wallet;
    this.aztecNode = aztecNode;
    this.config = config;
    logger.info('ContractRegistryService initialized');
  }

  isInitialized(): boolean {
    return (
      this.wallet !== null && this.aztecNode !== null && this.config !== null
    );
  }

  getContractsForTab(tab: TabType): ContractGroup[] {
    return TAB_CONTRACT_MAP[tab];
  }

  areContractsRegisteredForTab(tab: TabType): boolean {
    const required = TAB_CONTRACT_MAP[tab];
    return required.every((contract) => this.registeredContracts.has(contract));
  }

  async registerForTab(tab: TabType): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('ContractRegistryService not initialized');
    }

    const requiredContracts = TAB_CONTRACT_MAP[tab];

    if (!requiredContracts.length) {
      return;
    }

    const contractsToRegister = requiredContracts.filter(
      (contract) => !this.registeredContracts.has(contract)
    );

    if (!contractsToRegister.length) return;

    for (const contract of contractsToRegister) {
      await this.registerContract(contract);
    }
  }

  private async registerContract(contract: ContractGroup): Promise<void> {
    if (this.registeredContracts.has(contract)) {
      return;
    }

    const existingRegistration = this.registrationInProgress.get(contract);
    if (existingRegistration) {
      return existingRegistration;
    }

    const registrationPromise = this.performRegistration(contract);
    this.registrationInProgress.set(contract, registrationPromise);

    try {
      await registrationPromise;
      this.registeredContracts.add(contract);
    } finally {
      this.registrationInProgress.delete(contract);
    }
  }

  /**
   * Perform the contract registration with PXE
   */
  private async performRegistration(contract: ContractGroup): Promise<void> {
    if (!this.wallet || !this.aztecNode || !this.config) {
      throw new Error('ContractRegistryService not initialized');
    }

    const { instance, artifact } =
      await this.getContractInstanceAndArtifact(contract);

    await this.wallet.registerContract({
      instance,
      artifact,
    });
  }

  private async getContractInstanceAndArtifact(
    contract: ContractGroup
  ): Promise<{ instance: ContractInstanceWithAddress; artifact: any }> {
    if (!this.config || !this.aztecNode) {
      throw new Error('ContractRegistryService not initialized');
    }

    //TODO: Need to improve the way we call this, cause if we add more contracts we will have to add more cases here and its not scalable
    switch (contract) {
      case ContractGroups.Dripper: {
        const deployer = AztecAddress.fromString(
          this.config.deployerAddress as string
        );
        const salt = this.config.dripperDeploymentSalt ?? Fr.fromString('1337');
        const instance = await getContractInstanceFromInstantiationParams(
          DripperContractArtifact,
          {
            salt,
            constructorArtifact: 'constructor',
            constructorArgs: [],
            deployer,
          }
        );

        // Validate address
        if (!instance.address.equals(this.config.dripperContractAddress)) {
          throw new Error(
            `Dripper address mismatch! Computed: ${instance.address.toString()}, Expected: ${this.config.dripperContractAddress.toString()}`
          );
        }

        return { instance, artifact: DripperContractArtifact };
      }

      case ContractGroups.WonderToken: {
        const deployer = AztecAddress.fromString(
          this.config.deployerAddress as string
        );
        const salt = this.config.tokenDeploymentSalt ?? Fr.fromString('1337');
        const instance = await getContractInstanceFromInstantiationParams(
          WonderTokenContractArtifact,
          {
            salt,
            constructorArtifact: 'constructor_with_minter',
            constructorArgs: [
              'WETH',
              'WETH',
              18,
              this.config.dripperContractAddress,
              AztecAddress.ZERO,
            ],
            deployer,
          }
        );

        // Validate address
        if (!instance.address.equals(this.config.tokenContractAddress)) {
          throw new Error(
            `Token address mismatch! Computed: ${instance.address.toString()}, Expected: ${this.config.tokenContractAddress.toString()}`
          );
        }

        return { instance, artifact: WonderTokenContractArtifact };
      }

      case ContractGroups.BridgeToken: {
        const instance = await this.aztecNode.getContract(
          AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH)
        );

        if (!instance) {
          throw new Error('Bridge token contract not found on node');
        }

        return {
          instance: instance as ContractInstanceWithAddress,
          artifact: AztecTokenContract.artifact,
        };
      }

      case ContractGroups.AztecGateway: {
        const instance = await this.aztecNode.getContract(
          AztecAddress.fromString(BRIDGE_CONFIG.aztecGateway)
        );

        if (!instance) {
          throw new Error('Gateway contract not found on node');
        }

        return {
          instance: instance as ContractInstanceWithAddress,
          artifact: AztecGateway7683Contract.artifact,
        };
      }

      default:
        throw new Error(`Unknown contract group: ${contract}`);
    }
  }

  getRegisteredContracts(): ContractGroup[] {
    return Array.from(this.registeredContracts);
  }
}

export const contractRegistryService = new ContractRegistryService();

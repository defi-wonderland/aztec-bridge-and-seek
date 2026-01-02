import { createLogger } from '@aztec/foundation/log';
import {
  getContractInstanceFromInstantiationParams,
  ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { type AztecNode } from '@aztec/aztec.js/node';

import { DripperContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/Dripper.js';
import { TokenContractArtifact as WonderTokenContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/Token.js';
import { getAztecGatewayArtifact } from '../../../artifacts/lazyGateway.ts';
import { AZTEC_WETH, AZTEC_USDC, AZTEC_GATEWAY } from '../../../config';
import { AppConfig } from '../../../config/networks';
import { TabType } from '../../../types';
import { EmbeddedAztecWallet } from './EmbeddedAztecWallet';

const logger = createLogger('contract-registry');

export const ContractGroups = {
  Dripper: 'Dripper',
  WonderToken: 'WonderToken',
  BridgeToken: 'BridgeToken',
  USDCToken: 'USDCToken',
  AztecGateway: 'AztecGateway',
} as const;

export type ContractGroup =
  (typeof ContractGroups)[keyof typeof ContractGroups];

const TAB_CONTRACT_MAP: Record<TabType, ContractGroup[]> = {
  mint: [ContractGroups.Dripper, ContractGroups.WonderToken],
  bridge: [
    ContractGroups.AztecGateway,
    ContractGroups.BridgeToken,
    ContractGroups.USDCToken,
  ],
  swap: [
    ContractGroups.AztecGateway,
    ContractGroups.BridgeToken,
    ContractGroups.USDCToken,
  ],
  settings: [],
  senders: [],
  info: [ContractGroups.WonderToken, ContractGroups.BridgeToken],
};

export class ContractRegistryService {
  private registeredContracts: Set<ContractGroup> = new Set();
  private registrationInProgress: Map<ContractGroup, Promise<void>> = new Map();
  private unavailableContracts: Map<ContractGroup, string> = new Map(); // Contracts that failed to load
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

  /**
   * Check if all contracts for a tab have been processed (registered or failed).
   * This returns true once we've attempted to load all contracts, even if some failed.
   */
  areContractsProcessedForTab(tab: TabType): boolean {
    const required = TAB_CONTRACT_MAP[tab];
    return required.every(
      (contract) =>
        this.registeredContracts.has(contract) ||
        this.unavailableContracts.has(contract)
    );
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

    // Skip if already known to be unavailable
    if (this.unavailableContracts.has(contract)) {
      logger.warn(
        `Skipping ${contract}: ${this.unavailableContracts.get(contract)}`
      );
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // Use warn instead of error - some contracts may be temporarily unavailable
      logger.warn(`Contract ${contract} unavailable: ${errorMessage}`);
      this.unavailableContracts.set(contract, errorMessage);
      // Don't re-throw - allow the app to continue without this contract
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

    await this.wallet.registerContract(instance, artifact);
  }

  private async getContractInstanceAndArtifact(
    contract: ContractGroup
  ): Promise<{ instance: ContractInstanceWithAddress; artifact: any }> {
    if (!this.config || !this.aztecNode) {
      throw new Error('ContractRegistryService not initialized');
    }

    const deployer = this.config.deployerAddress
      ? this.config.deployerAddress
      : AztecAddress.ZERO;

    //TODO: Need to improve the way we call this, cause if we add more contracts we will have to add more cases here and its not scalable
    switch (contract) {
      case ContractGroups.Dripper: {
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

        return { instance, artifact: DripperContractArtifact };
      }

      case ContractGroups.WonderToken: {
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

        return { instance, artifact: WonderTokenContractArtifact };
      }

      case ContractGroups.BridgeToken: {
        const instance = await this.aztecNode.getContract(
          AztecAddress.fromString(AZTEC_WETH)
        );

        if (!instance) {
          throw new Error('Bridge token contract not found on node');
        }

        // Debug: Log the contract class id from the deployed contract
        logger.info(
          'BridgeToken deployed currentContractClassId:',
          instance.currentContractClassId.toString()
        );

        return {
          instance: instance as ContractInstanceWithAddress,
          artifact: WonderTokenContractArtifact,
        };
      }

      case ContractGroups.USDCToken: {
        const instance = await this.aztecNode.getContract(
          AztecAddress.fromString(AZTEC_USDC)
        );

        if (!instance) {
          throw new Error('USDC token contract not found on node');
        }

        logger.info(
          'USDCToken deployed currentContractClassId:',
          instance.currentContractClassId.toString()
        );

        return {
          instance: instance as ContractInstanceWithAddress,
          artifact: WonderTokenContractArtifact,
        };
      }

      case ContractGroups.AztecGateway: {
        // Load artifact lazily to handle incompatible versions gracefully
        const artifact = await getAztecGatewayArtifact();
        if (!artifact) {
          throw new Error(
            'AztecGateway artifact not available - may be incompatible with current Aztec version'
          );
        }

        const instance = await this.aztecNode.getContract(
          AztecAddress.fromString(AZTEC_GATEWAY)
        );

        if (!instance) {
          throw new Error('Gateway contract not found on node');
        }

        // Debug: Log the contract class id from the deployed contract
        logger.info(
          'AztecGateway deployed currentContractClassId:',
          instance.currentContractClassId.toString()
        );

        return {
          instance: instance as ContractInstanceWithAddress,
          artifact,
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

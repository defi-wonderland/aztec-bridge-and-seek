import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';

export interface NetworkConfig {
  name: string;
  displayName: string;
  description: string;
  nodeUrl: string;
  deployerAddress?: string;
  dripperContractAddress: AztecAddress;
  tokenContractAddress: AztecAddress;
  dripperDeploymentSalt?: Fr;
  tokenDeploymentSalt?: Fr;
  proverEnabled: boolean;
  isTestnet: boolean;
}

export interface CustomConfig extends Omit<NetworkConfig, 'name' | 'displayName' | 'description' | 'isTestnet'> {
  name: 'custom';
  displayName: 'Custom Configuration';
  description: 'User-defined network configuration';
  isTestnet: false;
}

export type AppConfig = NetworkConfig | CustomConfig;
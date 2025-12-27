import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';

export interface BridgeConfig {
  aztecGateway: string;
  evmGateway: string;
  swapHookAddress: string;
  aztecWeth: string;
  aztecUsdc: string;
  evmWeth: string;
  evmUsdc: string;
  evmChainId: number;
  aztecExplorerUrl: string;
  evmExplorerUrl: string;
}

export interface NetworkConfig {
  name: string;
  displayName: string;
  description: string;
  nodeUrl: string;
  evmRpcUrl?: string;
  deployerAddress?: AztecAddress;
  dripperContractAddress: AztecAddress;
  tokenContractAddress: AztecAddress;
  dripperDeploymentSalt?: Fr;
  tokenDeploymentSalt?: Fr;
  proverEnabled: boolean;
  isDevnet: boolean;
  bridge?: BridgeConfig;
}

export interface CustomConfig
  extends Omit<
    NetworkConfig,
    'name' | 'displayName' | 'description' | 'isDevnet'
  > {
  name: 'custom';
  displayName: 'Custom Configuration';
  description: 'User-defined network configuration';
  isDevnet: false;
}

export type AppConfig = NetworkConfig | CustomConfig;

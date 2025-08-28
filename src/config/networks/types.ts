export interface NetworkConfig {
  name: string;
  displayName: string;
  description: string;
  nodeUrl: string;
  deployerAddress: string;
  dripperContractAddress: string;
  dripperDeploymentSalt: string;
  tokenContractAddress: string;
  tokenDeploymentSalt: string;
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
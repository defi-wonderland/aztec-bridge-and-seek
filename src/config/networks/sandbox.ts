import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x2f1bd76b6c5ec022c9fc72c5ecd3992468b220ad8ac2345411c2c5e7f585cd75',
  tokenContractAddress: '0x1f1369be7cbb4ba1c8a2a67635f71c9ffc816a170d009f9429003a9c7554b074',
  proverEnabled: true,
  isTestnet: false,
};

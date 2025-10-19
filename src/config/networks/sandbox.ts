import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x11f55e3acc4a76f7232bf03efd6c4c898fd2c0e9769cff252ea2b4f077b820c3',
  tokenContractAddress: '0x2377eaf7bb7f7c41ef0f5ab65fc50302559eb2437b3e53f5fdc7d02b7dfb364e',
  proverEnabled: true,
  isTestnet: false,
};

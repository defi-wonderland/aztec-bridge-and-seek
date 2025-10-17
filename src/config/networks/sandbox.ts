import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x211d9b708ed0f1c88b37dc2ded56da50dab8a6289dcec676508c6c39a7c0e85e',
  tokenContractAddress: '0x13d643e7e37cde438494594996a099c4c827ed4ac40cbec6cc4765f5b6768c92',
  proverEnabled: true,
  isTestnet: false,
};

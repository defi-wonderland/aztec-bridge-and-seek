import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x1690e02e4a2fc4c0e0d59ea7dd2976a7e018c422c29222f47ce73db861390c25',
  tokenContractAddress: '0x203ae40f5ed632003c30806ffd5d4956527eeaf2d29818deb498bd0a68598346',
  deployerAddress: '0x014414369acafa52e60fe12d7d12e28a2486f5dc8dff6f268c8be42587e4d11d',
  dripperDeploymentSalt: '0x1b1a0811c97e010b19fab8722bc9d006b0d139829e74d3f94d6749e4c15a516e',
  tokenDeploymentSalt: '0x3062fe41172ad82dcfa49fce48cda3aa695c1d5f6549b11a6d3b1eb33fd4ae48',
  proverEnabled: true,
  isTestnet: false,
};

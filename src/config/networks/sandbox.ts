import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x094c5a7fb724fb938b497dee60aabc31ad41f838c1cef9797210efd03517944f',
  tokenContractAddress: '0x1dec4aeb8a4a3526fb2616ff8f2d811f5219f001950fd0313ba9ae69166a1000',
  deployerAddress: '0x014414369acafa52e60fe12d7d12e28a2486f5dc8dff6f268c8be42587e4d11d',
  dripperDeploymentSalt: '0x1b1a0811c97e010b19fab8722bc9d006b0d139829e74d3f94d6749e4c15a516e',
  tokenDeploymentSalt: '0x3062fe41172ad82dcfa49fce48cda3aa695c1d5f6549b11a6d3b1eb33fd4ae48',
  proverEnabled: true,
  isTestnet: false,
};

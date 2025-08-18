import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  contractAddress: '0x0a36ae47a3ffbcf802db3933333ffa0d570a6356084f7a8d9988a11bfee6c427',
  dripperContractAddress: '0x152a652adad4aaa73a89e10a7dccc4ba00f061354e1e2d8950dca383bb6d97eb',
  tokenContractAddress: '0x2073829ea98f2a90d4316f93a9302b206b06bb2756946bafc1e8d98abcc17fe0',
  deployerAddress: '0x26a915afec38eced237e62f00799ade7b76b55e4a320e8628dd96788256ec4d5',
  deploymentSalt: '0x13f0cb97fb43eb6e2cc5c32920bbb8c7142e4195d4281abe0e53a7ed6a9b6fd6',
  dripperDeploymentSalt: '0x063f7267d1b2562fc0211f1504e4becaa0cac1e5b93d0d90814d074c8a1763e7',
  tokenDeploymentSalt: '0x18207b729587d1d9c10dfa7b86ae61b59b90ae020201fdcb803cb7965eb42025',
  proverEnabled: true,
  isTestnet: false,
};

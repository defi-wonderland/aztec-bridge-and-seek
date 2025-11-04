import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: AztecAddress.fromString('0x1673b0dbcc1ffcba1624e7a8e7a63194a042bccd421144e9c1cdae0d8eaa18cb'),
  tokenContractAddress: AztecAddress.fromString('0x1e29503becc992a91612d137facf93e062b88f24a663efc581d156695fe48f2f'),
  dripperDeploymentSalt: Fr.fromString('1337'),
  tokenDeploymentSalt: Fr.fromString('1337'),
  proverEnabled: true,
  isTestnet: false,
};

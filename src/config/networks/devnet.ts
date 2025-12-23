import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { NetworkConfig } from './types';

export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  dripperContractAddress: AztecAddress.fromString(
    '0x02bc708c7f88a6bacefb7133eaf97a55d28980717c72bbd63d36d516536d9c21'
  ),
  tokenContractAddress: AztecAddress.fromString(
    '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639'
  ),
  deployerAddress:
    '0x06efb30bfcadb59c2cd43b31ebcc5edda6d5c701afa772f1c30fcbd18957631f',
  nodeUrl: 'https://next.devnet.aztec-labs.com/',
  proverEnabled: true,
  isDevnet: true,
};

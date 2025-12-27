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
  nodeUrl: 'https://next.devnet.aztec-labs.com/',
  evmRpcUrl: process.env.EVM_RPC_URL,
  deployerAddress: AztecAddress.ZERO,
  proverEnabled: true,
  isDevnet: true,
  bridge: {
    aztecGateway: '0x1931c3d70613e1110df9740c46383a909acbe1c2a84ee6597099e6bfb6588c73',
    evmGateway: '0x85752d27D29FF5D0683b8aE1B60705080CA7142f',
    swapHookAddress: '0xae4078D513c9166389FA6Fce0635A29573b7B2cc',
    aztecWeth: '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
    aztecUsdc: '0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4',
    evmWeth: '0x13b8a81197e987e50872fabb9d59dbae5c4b1907',
    evmUsdc: '0xa52b8d7d08f2ac091fee807fcc7fd20d1da05bb1',
    evmChainId: 84532,
    aztecExplorerUrl: 'https://devnet.aztecscan.xyz/tx-effects/',
    evmExplorerUrl: 'https://sepolia.basescan.org/tx/',
  },
};

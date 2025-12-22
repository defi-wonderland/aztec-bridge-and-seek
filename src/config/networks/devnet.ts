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

// Bridge configuration for cross-chain transfers
export const BRIDGE_CONFIG = {
  aztecWETH:
    '0x22fe09c938746e25c2f3a9e2737209bf37bec5f825c8b7a06c367daab1c1b2c6',
  aztecUSDC:
    '0x2925b0b7212440baaace46ab05821ed589fad263fb5ff2243dd65eaaab84ab34',
  aztecGateway:
    '0x0011ca3cce73b704bba628c8ff420a9139500e9568284a74bc205dd3c28421b3',
  baseSepoliaWETH: '0xAf31a5CFf95131B2E0D3fa89125342984567f399',
  gateway: '0x36A3f6906AA16d70e70137498321363699a582cf',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
} as const;

import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { NetworkConfig } from './types';

export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  dripperContractAddress: AztecAddress.fromString(
    '0x1dd712303e81139c9ad77f15cd3a88a87946c5f821b78350bb9238122d9fe997'
  ),
  tokenContractAddress: AztecAddress.fromString(
    '0x2925b0b7212440baaace46ab05821ed589fad263fb5ff2243dd65eaaab84ab34'
  ),
  deployerAddress:
    '0x195f203e5dbdb9cb5afe95e382dd0c7d4b9ec3c952451cdafdd03a4230c90be5',
  nodeUrl: 'https://devnet.aztec-labs.com/',
  proverEnabled: true,
  isDevnet: true,
};

// Bridge configuration for cross-chain transfers
export const BRIDGE_CONFIG = {
  aztecWETH:
    '0x089d76aaa3261376f2073894cddff9a070c1ca2c3ae2a2b25fcce25d68caae81',
  aztecUSDC:
    '0x2925b0b7212440baaace46ab05821ed589fad263fb5ff2243dd65eaaab84ab34',
  bridgeSwapToken:
    '0x25c876b5d9532239132daaf34ba50fcb91a6a2e585713cc1818b06c90d677a78',
  aztecGateway:
    '0x1d00eed278af1188812a21fa4c2e38034424e166196229a25026ecc35c1502b9',
  baseSepoliaWETH: '0xAf31a5CFf95131B2E0D3fa89125342984567f399',
  gateway: '0x85752d27D29FF5D0683b8aE1B60705080CA7142f',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
} as const;

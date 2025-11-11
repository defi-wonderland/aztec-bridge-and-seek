import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { NetworkConfig } from './types';

export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: 'Public test network for testing with real tokens',
  dripperContractAddress: AztecAddress.fromString('0x1dd712303e81139c9ad77f15cd3a88a87946c5f821b78350bb9238122d9fe997'),
  tokenContractAddress: AztecAddress.fromString('0x2925b0b7212440baaace46ab05821ed589fad263fb5ff2243dd65eaaab84ab34'),
  nodeUrl: 'https://aztec-testnet-fullnode.zkv.xyz/',
  proverEnabled: true,
  isTestnet: true,
};

// Bridge configuration for cross-chain transfers
export const BRIDGE_CONFIG = {
  aztecWETH: '0x089d76aaa3261376f2073894cddff9a070c1ca2c3ae2a2b25fcce25d68caae81',
  aztecGateway: '0x1d00eed278af1188812a21fa4c2e38034424e166196229a25026ecc35c1502b9',
  baseSepoliaWETH: '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc',
  gateway: '0x85752d27D29FF5D0683b8aE1B60705080CA7142f',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
} as const;

import { NetworkConfig } from './types';

export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: 'Public test network for testing with real tokens',
  dripperContractAddress: '0x0c8912beccec01f90f1aba1fc04c8021acfc57bb311d12f06f155fcf2b6376c6',
  tokenContractAddress: '0x26d6674f54a2514526b930b00b1b9ad56435d77508fd7374c190dc509fe7c8a9',
  nodeUrl: 'https://aztec-testnet-fullnode.zkv.xyz/',
  proverEnabled: true,
  isTestnet: true,
};

// Bridge configuration for cross-chain transfers
export const BRIDGE_CONFIG = {
  aztecWETH: '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb',
  aztecGateway: '0x1b4f272b622a493184f6fbb83fc7631f1ce9bad68d4d4c150dc55eed5f100d73',
  baseSepoliaWETH: '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc',
  gateway: '0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
} as const;

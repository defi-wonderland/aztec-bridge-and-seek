import { NetworkConfig } from './types';

export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: 'Public test network for testing with real tokens',
  dripperContractAddress: '0x04c3b1bc6ee5fd991377f8da4a291ff745445328abb0c22e41ed7b5310aad479',
  tokenContractAddress: '0x0ef048ccf37f0ea475b6498dd6aca228df658362435ca58fa5b5cc47fba15057',
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

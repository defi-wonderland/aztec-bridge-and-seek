export * from './types';
export * from './sandbox';
export * from './testnet';

import { SANDBOX_CONFIG } from './sandbox';
import { TESTNET_CONFIG } from './testnet';
import { NetworkConfig } from './types';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  TESTNET_CONFIG,
  SANDBOX_CONFIG,
];

export const DEFAULT_NETWORK = TESTNET_CONFIG;

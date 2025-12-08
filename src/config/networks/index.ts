export * from './types';
export * from './sandbox';
export * from './devnet';

import { SANDBOX_CONFIG } from './sandbox';
import { DEVNET_CONFIG } from './devnet';
import { NetworkConfig } from './types';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  DEVNET_CONFIG,
  SANDBOX_CONFIG,
];

export const DEFAULT_NETWORK = DEVNET_CONFIG;

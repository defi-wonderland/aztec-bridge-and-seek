/**
 * Bridge Configuration
 * Constants and configuration for Aztec-EVM bridge operations
 * Based on Substance Labs Aztec-EVM Bridge
 */

// Gateway Contract Addresses
export const AZTEC_GATEWAY =
  '0x0fae77d834d26019a41402eb9388cd9d07123ab51876a5fefbeaf5f4be7fab23';
export const BASE_SEPOLIA_GATEWAY =
  '0x85752d27D29FF5D0683b8aE1B60705080CA7142f';

// Token Addresses - Aztec
export const AZTEC_WETH =
  '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639';
export const AZTEC_USDC =
  '0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4';

// Token Addresses - Base Sepolia
export const BASE_SEPOLIA_WETH = '0x13b8a81197e987e50872fabb9d59dbae5c4b1907';
export const BASE_SEPOLIA_USDC = '0xa52b8d7d08f2ac091fee807fcc7fd20d1da05bb1';
export const BRIDGE_SWAP_HOOK_ADDRESS =
  '0x69017e88640966c91C4D65D4A1eeA9fbD3B27e95';
// Recipient for bridge swap orders (same as hook address)
export const BRIDGE_SWAP_RECIPIENT = BRIDGE_SWAP_HOOK_ADDRESS;
// Chain IDs
export const AZTEC_DEVNET_CHAIN_ID = 999999;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Order Types
export const PUBLIC_ORDER = 0;
export const PRIVATE_ORDER = 1;
export const PUBLIC_ORDER_WITH_HOOK = 2;
export const PRIVATE_ORDER_WITH_HOOK = 3;

// Order Status (mirrors Aztec gateway contract)
export const UNKNOWN = 0;
export const OPENED = 1;
export const FILLED = 2;
export const FILLED_PRIVATELY = 3;
export const SETTLED = 4;
export const REFUNDED = 5;

// EVM Order Status (bytes32 constants from Base Sepolia gateway)
// These are the string "STATUS" padded to bytes32
export const EVM_ORDER_STATUS = {
  FILLED: '0x46494c4c45440000000000000000000000000000000000000000000000000000',
  REFUNDED:
    '0x524546554e444544000000000000000000000000000000000000000000000000',
} as const;

// Special Addresses
export const PRIVATE_SENDER =
  '0x0000000000000000000000000000000000000000000000000000000000000001';

// Order Data Type Hash (for gateway contract)
export const ORDER_DATA_TYPE_HASH =
  '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0';

// EIP-712 Type Hash for Order Data
export const ORDER_DATA_TYPE = {
  OrderData: [
    { name: 'sender', type: 'bytes32' },
    { name: 'recipient', type: 'bytes32' },
    { name: 'inputToken', type: 'bytes32' },
    { name: 'outputToken', type: 'bytes32' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOut', type: 'uint256' },
    { name: 'senderNonce', type: 'uint256' },
    { name: 'originDomain', type: 'uint256' },
    { name: 'destinationDomain', type: 'uint256' },
    { name: 'destinationSettler', type: 'bytes32' },
    { name: 'fillDeadline', type: 'uint256' },
    { name: 'orderType', type: 'uint256' },
    { name: 'data', type: 'bytes32' },
  ],
};

// Default values
export const DEFAULT_FILL_DEADLINE_SECONDS = 3600; // 1 hour
export const POLLING_INTERVAL_MS = 5000; // 5 seconds

// UI Constants
export const ADDRESS_TRUNCATE_START = 6;
export const ADDRESS_TRUNCATE_END = 4;
export const SUCCESS_MESSAGE_TIMEOUT = 3000;
export const ERROR_MESSAGE_TIMEOUT = 5000;

// Explorer URLs
export const AZTEC_EXPLORER_URL = 'https://devnet.aztecscan.xyz/tx-effects/';
export const BASE_EXPLORER_URL = 'https://sepolia.basescan.org/tx/';

/**
 * Bridge Constants
 * Based on Substance Labs Aztec-EVM Bridge
 */

// Gateway Contract Addresses
export const AZTEC_GATEWAY =
  '0x0011ca3cce73b704bba628c8ff420a9139500e9568284a74bc205dd3c28421b3';
export const BASE_SEPOLIA_GATEWAY =
  '0x36A3f6906AA16d70e70137498321363699a582cf';

// WETH Token Addresses
export const AZTEC_WETH =
  '0x22fe09c938746e25c2f3a9e2737209bf37bec5f825c8b7a06c367daab1c1b2c6';
export const BASE_SEPOLIA_WETH = '0xAf31a5CFf95131B2E0D3fa89125342984567f399';

// Chain IDs
export const AZTEC_DEVNET_CHAIN_ID = 999999;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Default timeout for Aztec transactions
export const AZTEC_TX_TIMEOUT = 60 * 15;

// Order Types
export const PUBLIC_ORDER = 0;
export const PRIVATE_ORDER = 1;

// Order Status (kept in sync with contract)
export const UNKNOWN = 0;
export const OPENED = 1;
export const FILLED = 2;
export const FILLED_PRIVATELY = 3;
export const SETTLED = 4;
export const REFUNDED = 5;

// Special Addresses
export const PRIVATE_SENDER =
  '0x0000000000000000000000000000000000000000000000000000000000000001';

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

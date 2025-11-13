/**
 * Bridge Constants
 * Based on Substance Labs Aztec-EVM Bridge
 */

// Gateway Contract Addresses
export const AZTEC_GATEWAY = '0x1d00eed278af1188812a21fa4c2e38034424e166196229a25026ecc35c1502b9';
export const BASE_SEPOLIA_GATEWAY = '0x85752d27D29FF5D0683b8aE1B60705080CA7142f';

// WETH Token Addresses
export const AZTEC_WETH = '0x089d76aaa3261376f2073894cddff9a070c1ca2c3ae2a2b25fcce25d68caae81';
export const BASE_SEPOLIA_WETH = '0xAf31a5CFf95131B2E0D3fa89125342984567f399';

// Chain IDs
export const AZTEC_TESTNET_CHAIN_ID = 999999;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Default timeout for Aztec transactions
export const AZTEC_TX_TIMEOUT = 60 * 15;

// Order Types
export const PUBLIC_ORDER = 0;
export const PRIVATE_ORDER = 1;

// Order Status
export const OPENED = 0;
export const FILLED = 1;
export const FILLED_PRIVATELY = 2;
export const REFUNDED = 3;

// Special Addresses
export const PRIVATE_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000001';

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
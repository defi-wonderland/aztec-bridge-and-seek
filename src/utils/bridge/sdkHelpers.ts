import { type Hex, pad, isHex } from 'viem';

/**
 * Pads an address to 32 bytes (64 hex characters + 0x prefix) as required by the Substance SDK.
 * Handles both EVM addresses (20 bytes) and Aztec addresses (32 bytes).
 *
 * @param address - The address to pad (can be any hex string)
 * @returns 32-byte padded hex string
 * @throws Error if the input is not a valid hex string
 *
 * @example
 * padTo32Bytes('0x1234') // '0x0000000000000000000000000000000000000000000000000000000000001234'
 * padTo32Bytes('0xAf31a5CFf95131B2E0D3fa89125342984567f399') // '0x000000000000000000000000af31a5cff95131b2e0d3fa89125342984567f399'
 */
export function padTo32Bytes(address: string): Hex {
  if (!isHex(address)) {
    throw new Error(`Invalid hex address: ${address}`);
  }

  return pad(address as Hex, { size: 32 });
}

/**
 * Converts an empty data field to a 32-byte padded hex string.
 * The SDK requires all data fields to be 32 bytes.
 *
 * @returns 32-byte padded zero hex string
 */
export function emptyData32Bytes(): Hex {
  return pad('0x', { size: 32 });
}

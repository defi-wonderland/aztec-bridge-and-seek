/**
 * Address validation utilities
 */

/** Regex pattern for validating EVM addresses (0x followed by 40 hex characters) */
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validates if a string is a valid EVM address format
 * @param address - The address string to validate
 * @returns true if valid EVM address format
 */
export const isValidEvmAddress = (address: string): boolean => {
  return EVM_ADDRESS_PATTERN.test(address);
};

/**
 * Truncates an address for display purposes
 * @param address - The full address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address string
 */
export const truncateAddress = (
  address: string,
  startChars = 6,
  endChars = 4
): string => {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

import { formatUnits } from 'viem';

/**
 * Format a bigint balance for display
 * @param balance - The balance in raw units
 * @param decimals - The number of decimals (default: 18)
 * @returns Formatted string representation
 */
export const formatBalance = (
  balance: bigint | null | undefined,
  decimals: number = 18
): string => {
  if (balance === null || balance === undefined) return '0.00';
  const formatted = formatUnits(balance, decimals);
  const num = parseFloat(formatted);

  if (num === 0) return '0.00';
  if (num < 0.000001 && num > 0) return '<0.000001';

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

/**
 * Sanitize input to only allow numeric values with single decimal point
 * @param value - The input string to sanitize
 * @returns Sanitized string containing only digits and at most one decimal point
 */
export const sanitizeNumericInput = (value: string): string => {
  // Remove all non-numeric characters except decimal point
  let sanitized = value.replace(/[^0-9.]/g, '');
  // Only allow one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }
  return sanitized;
};

/**
 * Format a bigint balance with full precision for tooltip display
 * @param balance - The balance in raw units
 * @param decimals - The number of decimals (default: 18)
 * @param symbol - Optional token symbol to append
 * @returns Full precision formatted string
 */
export const formatBalanceFull = (
  balance: bigint | null | undefined,
  decimals: number = 18,
  symbol?: string
): string => {
  if (balance === null || balance === undefined) {
    return symbol ? `0 ${symbol}` : '0';
  }
  const formatted = formatUnits(balance, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
};

/**
 * Format amount for display - show up to 6 decimals for small numbers
 * @param amount - The amount as a string
 * @returns Formatted string with appropriate precision
 */
export const formatDisplayAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return '0';
  if (num < 0.000001) return '<0.000001';
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

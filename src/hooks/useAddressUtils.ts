import { useCallback } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { ADDRESS_TRUNCATE_START, ADDRESS_TRUNCATE_END } from '../config/bridgeConstants';

type AddressInput = string | AztecAddress | undefined;

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: AddressInput): string => {
    if (!address) return 'No address set';

    // Convert AztecAddress to string if needed
    const addressStr = typeof address === 'string' ? address : address.toString();

    const formattedAddress = addressStr.startsWith('0x') ? addressStr : `0x${addressStr}`;

    if (formattedAddress.length <= 10) return formattedAddress;

    return `${formattedAddress.slice(0, ADDRESS_TRUNCATE_START)}...${formattedAddress.slice(-ADDRESS_TRUNCATE_END)}`;
  }, []);

  const formatAddress = useCallback((address: AddressInput): string => {
    if (!address) return '';

    // Convert AztecAddress to string if needed
    const addressStr = typeof address === 'string' ? address : address.toString();

    return addressStr.startsWith('0x') ? addressStr : `0x${addressStr}`;
  }, []);

  return {
    truncateAddress,
    formatAddress,
  };
};
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AppConfig } from '../config/networks';

export { isValidEvmAddress, truncateAddress } from './address';

export const isValidConfig = (config: any) => {
  if (
    !config.nodeUrl ||
    !config.tokenContractAddress ||
    !config.dripperContractAddress
  ) {
    return false;
  }

  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  if (!urlPattern.test(config.nodeUrl)) {
    return false;
  }

  // Validate Aztec addresses with proper error handling
  try {
    // These will throw if invalid format
    AztecAddress.fromString(config.tokenContractAddress.toString());
    AztecAddress.fromString(config.dripperContractAddress.toString());
    return true;
  } catch (error) {
    console.warn('Invalid Aztec address format in config:', error);
    return false;
  }
};

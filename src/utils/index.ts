import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AppConfig } from "../config/networks";

export const isValidConfig = (config: AppConfig): boolean => {
  // Check required fields exist
  if (!config.nodeUrl || !config.tokenContractAddress || !config.dripperContractAddress) {
    return false;
  }

  // Validate URL format
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
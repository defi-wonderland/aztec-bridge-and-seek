import { AztecAddress, Fr, AccountWallet } from '@aztec/aztec.js';
import { AztecWalletService } from './AztecWalletService';
import { AztecContractService } from './AztecContractService';
import { AztecStorageService } from './AztecStorageService';

import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { DripperContract } from '../../../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { AppConfig } from '../../../config/networks';

export interface WalletServices {
  // Core infrastructure
  storageService: AztecStorageService;
  walletService: AztecWalletService;
  contractService: AztecContractService;
  
  // Contract interaction services
  dripperService: AztecDripperService;
  tokenService: AztecTokenService;
}

/**
 * Initialize all wallet services and dependencies
 * Replaces both initialization.ts and the service creation from actions.ts
 */
export const initializeWalletServices = async (
  nodeUrl: string,
  config: AppConfig
): Promise<WalletServices> => {
  // Initialize core services (from initialization.ts)
  const storageService = new AztecStorageService();
  const walletService = new AztecWalletService(storageService);
  await walletService.initialize(nodeUrl);
  const contractService = new AztecContractService(walletService.getPXE());

  // Register contracts (from initialization.ts)
  await registerContracts(contractService, config);

  const dripperService = new AztecDripperService(
    () => walletService.getSponsoredFeePaymentMethod(),
    config.dripperContractAddress,
    () => walletService.getConnectedAccount()
  );

  const tokenService = new AztecTokenService(() => walletService.getConnectedAccount());

  return {
    storageService,
    walletService,
    contractService,
    dripperService,
    tokenService,
  };
};

/**
 * Register contracts with the contract service
 * Moved from initialization.ts
 */
const registerContracts = async (
  contractService: AztecContractService,
  config: AppConfig
): Promise<void> => {
  const deployerAddress = AztecAddress.fromString(config.deployerAddress);
  
  // Register Dripper contract
  const dripperDeploymentSalt = Fr.fromString(config.dripperDeploymentSalt);
  await contractService.registerContract(
    DripperContract.artifact,
    deployerAddress,
    dripperDeploymentSalt,
    [], // No constructor args for Dripper
    'constructor' // Pass the specific constructor artifact
  );

  // Register Token contract
  const tokenDeploymentSalt = Fr.fromString(config.tokenDeploymentSalt);
  await contractService.registerContract(
    TokenContract.artifact,
    deployerAddress,
    tokenDeploymentSalt,
    [
      "Yield Token", // name
      "YT", // symbol
      18, // decimals
      AztecAddress.fromString(config.dripperContractAddress), // minter (Dripper address)
      AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
    ],
    'constructor_with_minter' // Pass the specific constructor artifact
  );
};

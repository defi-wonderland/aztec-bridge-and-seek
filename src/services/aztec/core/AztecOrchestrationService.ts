import { AztecAddress, Fr, AccountWallet } from '@aztec/aztec.js';
import { AztecWalletService } from './AztecWalletService';
import { AztecContractService } from './AztecContractService';
import { AztecStorageService } from './AztecStorageService';

import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { AztecSendersService } from '../features/AztecSendersService';
import { DripperContract } from '../../../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { TokenContractArtifact as AztecTokenContractArtifact } from '@aztec/noir-contracts.js/Token';
import { AppConfig } from '../../../config/networks';
import { AztecBridgeService } from '../features/AztecBridgeService';

export interface CoreServices {
  // Core infrastructure (no account needed)
  storageService: AztecStorageService;
  walletService: AztecWalletService;
  contractService: AztecContractService;
}

export interface AccountDependentServices {
  // Contract interaction services (require connected account)
  dripperService: AztecDripperService;
  tokenService: AztecTokenService;
  bridgeService: AztecBridgeService;
  sendersService: AztecSendersService;
}

export interface WalletServices extends CoreServices, AccountDependentServices {}

/**
 * Initialize core services that don't require a connected account
 * This can be called during app startup
 */
export const initializeCoreServices = async (
  nodeUrl: string,
  config: AppConfig
): Promise<CoreServices> => {
  // Initialize core services
  const storageService = new AztecStorageService();
  const walletService = new AztecWalletService(storageService);
  await walletService.initialize(nodeUrl);
  const contractService = new AztecContractService(walletService.getPXE());

  // Register contracts
  await registerContracts(contractService, config);

  return {
    storageService,
    walletService,
    contractService,
  };
};

/**
 * Initialize account-dependent services when an account is connected
 * This should be called after account connection
 */
export const initializeAccountDependentServices = async (
  coreServices: CoreServices,
  config: AppConfig
): Promise<AccountDependentServices> => {
  const { storageService, walletService } = coreServices;

  // Get account dependencies
  const connectedAccount = walletService.getConnectedAccount();
  if (!connectedAccount) {
    throw new Error('No account connected - cannot initialize account-dependent services');
  }

  const sponsoredFeePaymentMethod = await walletService.getSponsoredFeePaymentMethod();
  const pxe = walletService.getPXE();

  const dripperService = new AztecDripperService(
    sponsoredFeePaymentMethod,
    config.dripperContractAddress,
    connectedAccount
  );

  const tokenService = new AztecTokenService(connectedAccount);

  const bridgeService = new AztecBridgeService(
    pxe,
    connectedAccount
  );

  const sendersService = new AztecSendersService(pxe, storageService);

  // Register saved senders using the new service
  await sendersService.registerSavedSenders();

  return {
    dripperService,
    tokenService,
    bridgeService,
    sendersService,
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
  // Register Dripper contract
  const dripperDeploymentSalt = Fr.fromString(config.dripperDeploymentSalt);
  const dripperDeployer = AztecAddress.fromString(config.deployerAddress);
  
  await contractService.registerContract(
    DripperContract.artifact,
    dripperDeployer,
    dripperDeploymentSalt,
    [], // No constructor args for Dripper
    'constructor' // Pass the specific constructor artifact
  );

  // Register Token contract
  const tokenDeploymentSalt = Fr.fromString(config.tokenDeploymentSalt);
  const tokenDeployer = AztecAddress.fromString(config.deployerAddress);

  await contractService.registerContract(
    TokenContract.artifact,
    tokenDeployer,
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

  // Register WETH contract if on testnet
  if (config.isTestnet) {
    try {
      const wethDeploymentSalt = Fr.fromHexString('0x21709ebd7c082ffe19291eca4b0ab5220814dbc07d79e8c876c1a37f3bbf3cd0');
      const wethDeployer = AztecAddress.fromString('0x2103c4465e9d73a7b400576451beae75839e215178c0846120e9ed261ebf4f58');

      await contractService.registerContract(
        AztecTokenContractArtifact,
        wethDeployer,
        wethDeploymentSalt,
        [
          wethDeployer,
          "Wrapped Ethereum",
          "WETH",
          18,
        ],
        'constructor'
      );
    } catch (error) {
      // Don't fail initialization if WETH registration fails
    }
  }
};



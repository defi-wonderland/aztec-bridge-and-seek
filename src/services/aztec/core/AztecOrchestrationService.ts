import { AztecAddress, createAztecNodeClient } from '@aztec/aztec.js';
import { AztecWalletService } from './AztecWalletService';
import { AztecContractService } from './AztecContractService';
import { AztecStorageService } from './AztecStorageService';

import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { AztecSendersService } from '../features/AztecSendersService';
// import { TokenContractArtifact } from '../../../../artifacts/Token.js';
// import { DripperContractArtifact } from '../../../../artifacts/Dripper.js';
import { TokenContractArtifact } from '@defi-wonderland/aztec-standards/current/artifacts/Token';
import { DripperContractArtifact } from '@defi-wonderland/aztec-standards/current/artifacts/Dripper';
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
    connectedAccount,
    sponsoredFeePaymentMethod
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

  const node = await createAztecNodeClient(config.nodeUrl);
  
  const dripperInstance = await node.getContract(
    AztecAddress.fromString(config.dripperContractAddress),
  )
  await contractService.pxe.registerContract({
    instance: dripperInstance!,
    artifact: DripperContractArtifact,
  });

  const tokenInstance = await node.getContract(
    AztecAddress.fromString(config.tokenContractAddress),
  )
  await contractService.pxe.registerContract({
    instance: tokenInstance!,
    artifact: TokenContractArtifact,
  });
  
  // Register WETH contract if on testnet
  if (config.isTestnet) {
    // try {
    //   await contractService.pxe.registerContract({
    //     instance: (await createAztecNodeClient(config.nodeUrl).getContract(
    //       AztecAddress.fromString(AZTEC_WETH),
    //     ))!,
    //     artifact: AztecTokenContractArtifact,
    //   })
    //   await contractService.pxe.registerContract({
    //     instance: (await createAztecNodeClient(config.nodeUrl).getContract(
    //       AztecAddress.fromString(AZTEC_GATEWAY),
    //     ))!,
    //     artifact: AztecGateway7683ContractArtifact,
    //   })
    // } catch (error) {
    //   // Don't fail initialization if WETH registration fails
    // }
  }
};



import { AztecAddress, Fr, createAztecNodeClient, getContractClassFromArtifact, getContractInstanceFromInstantiationParams, PublicKeys, Wallet } from '@aztec/aztec.js';
import { createStore } from '@aztec/kv-store/indexeddb';
import { createLogger } from '@aztec/foundation/log';
import { AztecWalletService } from './AztecWalletService';
// import { AztecWalletDB } from './AztecWalletDB';
import { AztecStorageService } from './AztecStorageService';

import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { DripperContractArtifact } from '../../../artifacts/artifacts/Dripper.js';
import { TokenContractArtifact } from '../../../artifacts/artifacts/Token.js';

import { TokenContractArtifact as AztecTokenContractArtifact } from '@aztec/noir-contracts.js/Token';
import { AppConfig } from '../../../config/networks';
import { AztecBridgeService } from '../features/AztecBridgeService';
import { AZTEC_GATEWAY, AZTEC_WETH } from '../../../config';

export interface CoreServices {
  // walletDB: AztecWalletDB;
  walletService: AztecWalletService;
}

export interface AccountDependentServices {
  // Contract interaction services (require connected account)
  dripperService: AztecDripperService;
  tokenService: AztecTokenService;
  bridgeService: AztecBridgeService;
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
  // Create logger for wallet DB
  const logger = createLogger('wallet-db');
  const pxeLogger = createLogger('pxe');

  // Initialize IndexedDB store for WalletDB
  // Use rollup address to ensure different networks have separate databases
  const aztecNode = await createAztecNodeClient(nodeUrl);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const rollupAddress = l1Contracts.rollupAddress;

  // Create separate IndexedDB stores for WalletDB and PXE
  const walletDBStore = await createStore(
    `aztec-bridge-wallet-${rollupAddress.toString()}`,
    {
      dataDirectory: 'wallet',
      dataStoreMapSizeKB: 2e10, // 20GB max size
    },
    logger
  );

  const pxeStore = await createStore(
    `aztec-bridge-pxe-${rollupAddress.toString()}`,
    {
      dataDirectory: 'pxe',
      dataStoreMapSizeKB: 2e10, // 20GB max size
    },
    pxeLogger
  );

  // Initialize WalletDB (for senders)
  // const walletDB = AztecWalletDB.init(walletDBStore, logger.info);

  // Initialize StorageService (for account data)
  const storageService = new AztecStorageService();

  // Initialize wallet service with WalletDB and StorageService
  const walletService = new AztecWalletService(storageService);
  await walletService.initialize(nodeUrl, pxeStore);

  // Register contracts
  // await registerContracts(contractService, config);

  return {
    walletService,
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
  const { walletService } = coreServices;

  // Get account dependencies
  const connectedWallet = walletService.getConnectedAccount();
  if (!connectedWallet) {
    throw new Error('No account connected - cannot initialize account-dependent services');
  }

  const sponsoredFeePaymentMethod = await walletService.getSponsoredFeePaymentMethod();
  const pxe = walletService.getPXE();

  const dripperService = new AztecDripperService(
    sponsoredFeePaymentMethod,
    config.dripperContractAddress,
    connectedWallet
  );

  const tokenService = new AztecTokenService(connectedWallet);

  const bridgeService = new AztecBridgeService(
    pxe,
    connectedWallet,
    sponsoredFeePaymentMethod
  );

  return {
    dripperService,
    tokenService,
    bridgeService,
  };
};

/**
 * Register contracts with the contract service
 * Moved from initialization.ts
 */
const registerContracts = async (
  wallet: Wallet,
  config: AppConfig
): Promise<void> => {

  const node = await createAztecNodeClient(config.nodeUrl);
  
  const dripperInstance = await node.getContract(
    AztecAddress.fromString(config.dripperContractAddress),
  )
  // await contractService.pxe.registerContract({
  //   instance: dripperInstance!,
  //   artifact: DripperContractArtifact,
  // });

  // const tokenInstance = await node.getContract(
  //   AztecAddress.fromString(config.tokenContractAddress),
  // )
  // await contractService.pxe.registerContract({
  //   instance: tokenInstance!,
  //   artifact: TokenContractArtifact,
  // });
  
  // Register WETH contract if on testnet
  // if (config.isTestnet) {
  //   try {
  //     await contractService.pxe.registerContract({
  //       instance: (await createAztecNodeClient(config.nodeUrl).getContract(
  //         AztecAddress.fromString(AZTEC_WETH),
  //       ))!,
  //       artifact: AztecTokenContractArtifact,
  //     })
  //     await contractService.pxe.registerContract({
  //       instance: (await createAztecNodeClient(config.nodeUrl).getContract(
  //         AztecAddress.fromString(AZTEC_GATEWAY),
  //       ))!,
  //       artifact: AztecGateway7683ContractArtifact,
  //     })
  //   } catch (error) {
  //     // Don't fail initialization if WETH registration fails
  //   }
  // }
};



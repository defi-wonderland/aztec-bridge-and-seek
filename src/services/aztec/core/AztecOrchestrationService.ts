/**
 * Aztec Orchestration Service
 *
 * Simplified initialization pattern following vanilla box approach:
 * 1. Initialize wallet (PXE + Node + EmbeddedAztecWallet)
 * 2. Initialize services once account is connected
 *
 * No intermediate service layers - services use EmbeddedAztecWallet directly.
 */

import { createLogger } from '@aztec/foundation/log';
import { createStore } from '@aztec/kv-store/indexeddb';
import { AztecAddress, createAztecNodeClient } from '@aztec/aztec.js';
import { type AztecAsyncKVStore } from '@aztec/kv-store';

import { EmbeddedAztecWallet } from './EmbeddedAztecWallet';
import { AztecStorageService } from './AztecStorageService';
import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { AztecBridgeService } from '../features/AztecBridgeService';
import { AppConfig } from '../../../config/networks';
import { DripperContractArtifact } from '../../../artifacts/artifacts/Dripper';
import { TokenContractArtifact } from '../../../artifacts/artifacts/Token';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of wallet initialization
 * Contains the wallet instance and PXE store reference
 */
export interface InitializedWallet {
  wallet: EmbeddedAztecWallet;
  pxeStore: AztecAsyncKVStore;
}

/**
 * Account-dependent services that require a connected wallet
 * These are initialized after account connection
 */
export interface AccountDependentServices {
  bridgeService: AztecBridgeService;
  tokenService: AztecTokenService;
  dripperService: AztecDripperService;
}

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the Aztec wallet with PXE and Node
 *
 * This is the first step in the initialization process:
 * - Creates Aztec Node client
 * - Sets up IndexedDB stores for PXE and wallet data
 * - Initializes EmbeddedAztecWallet with sponsored FPC
 * - Returns wallet instance ready for account operations
 *
 * @param nodeUrl - URL of the Aztec node
 * @param config - Application configuration
 * @returns Initialized wallet and PXE store
 */
export const initializeWallet = async (
  nodeUrl: string,
  config: AppConfig
): Promise<InitializedWallet> => {
  const logger = createLogger('wallet-init');
  const pxeLogger = createLogger('pxe');

  // Get rollup address for network-specific database
  const aztecNode = createAztecNodeClient(nodeUrl);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const rollupAddress = l1Contracts.rollupAddress;

  // Create PXE store with IndexedDB
  const pxeStore = await createStore(
    `aztec-bridge-pxe-${rollupAddress.toString()}`,
    {
      dataDirectory: 'pxe',
      dataStoreMapSizeKB: 2e10, // 20GB max size
    },
    pxeLogger
  );

  // Initialize storage service for account persistence
  const storageService = new AztecStorageService();

  // Initialize wallet with PXE and Node
  const wallet = await EmbeddedAztecWallet.initialize(
    nodeUrl,
    storageService,
    pxeStore
  );

  const node = await createAztecNodeClient(config.nodeUrl);
  
  const dripperInstance = await node.getContract(
    config.dripperContractAddress,
  ) 
  await wallet.registerContract({
    instance: dripperInstance!,
    artifact: DripperContractArtifact,
  });
   const tokenInstance = await node.getContract(
    config.tokenContractAddress,
  )
  
  await wallet.registerContract({
    instance: tokenInstance!,
    artifact: TokenContractArtifact,
  });

  logger.info('Wallet initialized successfully', {
    network: config.name,
    nodeUrl,
  });

  return {
    wallet,
    pxeStore,
  };
};

/**
 * Initialize account-dependent services
 *
 * These services require a connected account to function:
 * - BridgeService: Cross-chain bridge operations
 * - TokenService: Token balance queries
 * - DripperService: Faucet operations
 *
 * Call this after account connection (createAccountAndConnect or connectExistingAccount)
 *
 * @param wallet - EmbeddedAztecWallet with connected account
 * @param config - Application configuration
 * @returns Services initialized with the wallet
 * @throws Error if no account is connected
 */
export const initializeServices = async (
  wallet: EmbeddedAztecWallet,
  config: AppConfig
): Promise<AccountDependentServices> => {
  const logger = createLogger('services-init');

  // Verify account is connected
  const connectedAccount = wallet.getConnectedAccount();
  if (!connectedAccount) {
    throw new Error('Cannot initialize services: No account connected to wallet');
  }

  // Get dependencies from wallet
  const pxe = wallet.getPXE();
  const sponsoredFeePaymentMethod = await wallet.getSponsoredFeePaymentMethod();

  // Initialize services with wallet (implements Wallet interface via BaseWallet)
  const bridgeService = new AztecBridgeService(
    pxe,
    wallet,
    sponsoredFeePaymentMethod
  );

  const tokenService = new AztecTokenService(wallet);

  const dripperService = new AztecDripperService(
    sponsoredFeePaymentMethod,
    config.dripperContractAddress,
    wallet
  );

  logger.info('Services initialized successfully', {
    connectedAccount: connectedAccount.getAddress().toString(),
  });

  return {
    bridgeService,
    tokenService,
    dripperService,
  };
};

/**
 * Convenience type for all initialized components
 * Combines wallet and services for provider state
 */
export interface FullyInitializedApp extends InitializedWallet {
  services?: AccountDependentServices;
}

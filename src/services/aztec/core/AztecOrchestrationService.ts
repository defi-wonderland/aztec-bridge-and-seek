import { createLogger } from '@aztec/foundation/log';
import { createStore } from '@aztec/kv-store/indexeddb';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { type AztecAsyncKVStore } from '@aztec/kv-store';
import { Account } from '@aztec/aztec.js/account';

import { EmbeddedAztecWallet } from './EmbeddedAztecWallet';
import { AztecStorageService } from './AztecStorageService';
import { contractRegistryService } from './ContractRegistryService';
import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { AztecBridgeService } from '../features/AztecBridgeService';
import { AztecSendersService } from '../features/AztecSendersService';
import { AppConfig } from '../../../config/networks';
import { TabType } from '../../../types';
import { toastService } from '../../toastService';

/**
 * Result of wallet initialization
 * Contains the wallet instance, PXE store reference, and connected account (if any)
 */
export interface InitializedWallet {
  wallet: EmbeddedAztecWallet;
  pxeStore: AztecAsyncKVStore;
  connectedAccount: Account | null;
}

/**
 * Account-dependent services that require a connected wallet
 * These are initialized after account connection
 */
export interface AccountDependentServices {
  bridgeService: AztecBridgeService;
  tokenService: AztecTokenService;
  dripperService: AztecDripperService;
  sendersService: AztecSendersService;
}

/**
 * Initialize the Aztec wallet with PXE and Node
 * This is a consolidated initialization that:
 * 1. Initializes PXE
 * 2. Auto-connects existing account (if found in storage)
 * 3. Registers contracts for the default tab
 *
 * When this function completes, the app is fully ready to use.
 *
 * @param nodeUrl - URL of the Aztec node
 * @param config - Application configuration
 * @param defaultTab - The default tab to register contracts for (defaults to 'mint')
 * @returns Initialized wallet, PXE store, and connected account (if any)
 */
export const initializeWallet = async (
  nodeUrl: string,
  config: AppConfig,
  defaultTab: TabType = 'mint'
): Promise<InitializedWallet> => {
  const logger = createLogger('wallet-init');
  const pxeLogger = createLogger('pxe');

  // Show PXE initialization toast
  const initToastId = toastService.loading('🔄 Initializing...');

  try {
    // Get rollup address for network-specific database
    const aztecNode = createAztecNodeClient(nodeUrl);
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    const rollupAddress = l1Contracts.rollupAddress;

    // Create PXE store with IndexedDB
    const pxeStore = await createStore(
      `aztec-bridge-pxe-${rollupAddress.toString()}`,
      {
        dataDirectory: 'pxe',
        dataStoreMapSizeKb: 2e10, // 20GB max size
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

    contractRegistryService.initialize(wallet, aztecNode, config);

    let connectedAccount: Account | null = null;
    try {
      const accountAddress = await wallet.connectExistingAccount();
      if (accountAddress) {
        logger.info('Auto-connected existing account', {
          address: accountAddress.toString(),
        });

        await wallet.deployAccount();
        connectedAccount = wallet.getConnectedAccount();
      } else {
        logger.info('No existing account found in storage');
      }
    } catch (accountError) {
      logger.warn('Failed to auto-connect account:', accountError);
    }

    // Register contracts for the default tab
    try {
      await contractRegistryService.registerForTab(defaultTab);
      logger.info(`Contracts registered for default tab: ${defaultTab}`);
    } catch (contractError) {
      logger.error('Failed to register default tab contracts:', contractError);
    }

    logger.info('Wallet initialized successfully', {
      network: config.name,
      nodeUrl,
      hasAccount: !!connectedAccount,
      defaultTab,
    });

    toastService.dismiss(initToastId);

    return {
      wallet,
      pxeStore,
      connectedAccount,
    };
  } catch (error) {
    toastService.dismiss(initToastId);
    toastService.error(
      `❌ Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
};

/**
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
    throw new Error(
      'Cannot initialize services: No account connected to wallet'
    );
  }

  // Get dependencies from wallet
  const pxe = wallet.getPXE();
  const sponsoredFeePaymentMethod = await wallet.getSponsoredFeePaymentMethod();

  // Initialize services with wallet (implements Wallet interface via BaseWallet)
  const bridgeService = new AztecBridgeService(
    pxe,
    wallet,
    sponsoredFeePaymentMethod,
    config.evmRpcUrl
  );

  const tokenService = new AztecTokenService(wallet);

  const dripperService = new AztecDripperService(
    sponsoredFeePaymentMethod,
    config.dripperContractAddress,
    wallet
  );

  // Initialize storage service for senders management
  const storageService = new AztecStorageService();
  const sendersService = new AztecSendersService(storageService, pxe);

  // Register all stored senders with PXE for note discovery
  try {
    await sendersService.registerStoredSenders();
    logger.info('Stored senders registered with PXE');
  } catch (error) {
    logger.warn('Failed to register stored senders:', error);
  }

  logger.info('Services initialized successfully', {
    connectedAccount: connectedAccount.getAddress().toString(),
  });

  return {
    bridgeService,
    tokenService,
    dripperService,
    sendersService,
  };
};

/**
 * Convenience type for all initialized components
 * Combines wallet and services for provider state
 */
export interface FullyInitializedApp extends InitializedWallet {
  services?: AccountDependentServices;
}

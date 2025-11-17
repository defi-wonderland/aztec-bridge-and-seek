import { createLogger } from '@aztec/foundation/log';
import { createStore } from '@aztec/kv-store/indexeddb';
import {
  getContractInstanceFromInstantiationParams,
  ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { type AztecAsyncKVStore } from '@aztec/kv-store';

import { EmbeddedAztecWallet } from './EmbeddedAztecWallet';
import { AztecStorageService } from './AztecStorageService';
import { AztecDripperService } from '../features/AztecDripperService';
import { AztecTokenService } from '../features/AztecTokenService';
import { AztecBridgeService } from '../features/AztecBridgeService';
import { AztecSendersService } from '../features/AztecSendersService';
import { AppConfig } from '../../../config/networks';
import { BRIDGE_CONFIG } from '../../../config/networks/testnet';

import { DripperContractArtifact } from '../../../../src/artifacts/Dripper.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { TokenContractArtifact as WonderTokenContractArtifact } from '../../../../src/artifacts/Token.js';
import { AztecGateway7683Contract } from '../../../artifacts/AztecGateway7683.js';
import { toastService } from '../../toastService';

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
  sendersService: AztecSendersService;
}

/**
 * Initialize the Aztec wallet with PXE and Node
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

  // Show PXE initialization toast
  const pxeToastId = toastService.loading('🔄 Initializing PXE...');

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

    // Dismiss PXE initialization toast
    toastService.dismiss(pxeToastId);

    return await registerContractsAndInitialize(
      wallet,
      aztecNode,
      config,
      nodeUrl,
      storageService,
      pxeStore
    );
  } catch (error) {
    toastService.dismiss(pxeToastId);
    toastService.error(
      `❌ Failed to initialize PXE: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
};

async function registerContractsAndInitialize(
  wallet: EmbeddedAztecWallet,
  aztecNode: any,
  config: AppConfig,
  nodeUrl: string,
  storageService: AztecStorageService,
  pxeStore: any
): Promise<InitializedWallet> {
  const logger = createLogger('wallet-init');

  try {
    logger.info('Registering contracts from deployment parameters...');
    const startTime = performance.now();

    // Show toast notification
    const contractsToastId = toastService.loading(
      '📝 Registering contracts...'
    );

    // 🚀 STEP 1: Create all contract instances (can be done in parallel)
    logger.debug('Creating contract instances...');

    const dripperDeployer = AztecAddress.fromString(
      config.deployerAddress as string
    );
    const tokenDeployer = AztecAddress.fromString(
      config.deployerAddress as string
    );

    const [
      dripperInstance,
      tokenInstance,
      tokenBridgeInstance,
      aztecGatewayInstance,
    ] = await Promise.all([
      // Dripper
      getContractInstanceFromInstantiationParams(DripperContractArtifact, {
        salt: Fr.fromString('1337'),
        constructorArtifact: 'constructor',
        constructorArgs: [],
        deployer: dripperDeployer,
      }),
      // Wonderland Token
      getContractInstanceFromInstantiationParams(WonderTokenContractArtifact, {
        salt: Fr.fromString('1337'),
        constructorArtifact: 'constructor_with_minter',
        constructorArgs: [
          'WETH',
          'WETH',
          18,
          config.dripperContractAddress,
          AztecAddress.ZERO,
        ],
        deployer: tokenDeployer,
      }),
      // Bridge Token (WETH)
      aztecNode.getContract(AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH)),
      // Gateway
      aztecNode.getContract(
        AztecAddress.fromString(BRIDGE_CONFIG.aztecGateway)
      ),
    ]);

    // Validate instances
    logger.debug('Validating contract instances...');

    if (!dripperInstance.address.equals(config.dripperContractAddress)) {
      throw new Error(
        `Dripper address mismatch! Computed: ${dripperInstance.address.toString()}, Expected: ${config.dripperContractAddress.toString()}`
      );
    }

    if (!tokenInstance.address.equals(config.tokenContractAddress)) {
      throw new Error(
        `Token address mismatch! Computed: ${tokenInstance.address.toString()}, Expected: ${config.tokenContractAddress.toString()}`
      );
    }

    logger.debug('All instances validated ✅');

    // 🚀 STEP 2: Register all contracts in parallel
    logger.debug('Registering contracts with PXE...');

    await Promise.all([
      wallet.registerContract({
        instance: dripperInstance,
        artifact: DripperContractArtifact,
      }),
      wallet.registerContract({
        instance: tokenInstance,
        artifact: WonderTokenContractArtifact,
      }),
      wallet.registerContract({
        instance: tokenBridgeInstance as ContractInstanceWithAddress,
        artifact: AztecTokenContract.artifact,
      }),
      wallet.registerContract({
        instance: aztecGatewayInstance as ContractInstanceWithAddress,
        artifact: AztecGateway7683Contract.artifact,
      }),
    ]);

    const duration = performance.now() - startTime;
    logger.info(`✅ All contracts registered in ${Math.round(duration)}ms`);

    // Dismiss contracts toast
    toastService.dismiss(contractsToastId);
  } catch (error) {
    logger.error('Failed to register contracts:', error);

    // Show error toast
    toastService.error(
      `❌ Contract registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    throw new Error(
      `Contract registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  logger.info('Wallet initialized successfully', {
    network: config.name,
    nodeUrl,
  });

  return {
    wallet,
    pxeStore,
  };
}

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
    sponsoredFeePaymentMethod
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

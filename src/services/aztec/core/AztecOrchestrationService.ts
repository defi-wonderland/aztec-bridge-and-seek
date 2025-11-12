import { createLogger } from '@aztec/foundation/log';
import { createStore } from '@aztec/kv-store/indexeddb';
import {
  getContractInstanceFromInstantiationParams, ContractInstanceWithAddress
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
import { AppConfig } from '../../../config/networks';
import { BRIDGE_CONFIG } from '../../../config/networks/testnet';

import { DripperContractArtifact } from '../../../../src/artifacts/Dripper.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { TokenContractArtifact as WonderTokenContractArtifact } from '../../../../src/artifacts/Token.js';
import { AztecGateway7683Contract } from '../../../artifacts/AztecGateway7683.js';

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

  try {
    logger.info('Registering contracts from deployment parameters...');
    logger.info('Registering dripper contract...');

    const dripperDeployer = AztecAddress.fromString(config.deployerAddress as string);
    const dripperInstance = await getContractInstanceFromInstantiationParams(
      DripperContractArtifact,
      {
        salt: Fr.fromString('1337'),
        constructorArtifact: 'constructor',
        constructorArgs: [],
        deployer: dripperDeployer,
      }
    );

    logger.info('Dripper instance recreated', {
      computed: dripperInstance.address.toString(),
      expected: config.dripperContractAddress.toString(),
      match: dripperInstance.address.equals(config.dripperContractAddress),
    });

    if (!dripperInstance.address.equals(config.dripperContractAddress)) {
      throw new Error(
        `Dripper address mismatch! Computed: ${dripperInstance.address.toString()}, Expected: ${config.dripperContractAddress.toString()}`
      );
    }

    await wallet.registerContract({
      instance: dripperInstance,
      artifact: DripperContractArtifact,
    });

    logger.info('Registering wonderland token contract for dripper...');
    const tokenDeployer = AztecAddress.fromString(config.deployerAddress as string);
    const tokenInstance = await getContractInstanceFromInstantiationParams(
      WonderTokenContractArtifact,
      {
        salt: Fr.fromString('1337'),
        constructorArtifact: 'constructor_with_minter',
        constructorArgs: [
          'WETH',
          'WETH',
          18,
          config.dripperContractAddress,
          AztecAddress.ZERO
        ],
        deployer: tokenDeployer,
      }
    );

    logger.info('Token instance recreated', {
      computed: tokenInstance.address.toString(),
      expected: config.tokenContractAddress.toString(),
      match: tokenInstance.address.equals(config.tokenContractAddress),
    });

    if (!tokenInstance.address.equals(config.tokenContractAddress)) {
      throw new Error(
        `Token address mismatch! Computed: ${tokenInstance.address.toString()}, Expected: ${config.tokenContractAddress.toString()}`
      );
    }

    await wallet.registerContract({
      instance: tokenInstance,
      artifact: WonderTokenContractArtifact,
    });

    logger.info('Registering aztec token contract for bridging...');
    const tokenBridgeInstance = await aztecNode.getContract(AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH))

    await wallet.registerContract({
      instance: tokenBridgeInstance as ContractInstanceWithAddress,
      artifact: AztecTokenContract.artifact,
    });

    logger.info('Registering aztec token contract for bridging...');
    const aztecGatewayInstance = await aztecNode.getContract(AztecAddress.fromString(BRIDGE_CONFIG.aztecGateway))

    await wallet.registerContract({
      instance: aztecGatewayInstance as ContractInstanceWithAddress,
      artifact: AztecGateway7683Contract.artifact,
    });

    logger.info('Contracts registered successfully');
  } catch (error) {
    logger.error('Failed to register contracts:', error);
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

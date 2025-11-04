import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAsyncOperation, useConfig } from '../hooks';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import {
  initializeWallet,
  initializeServices,
} from '../services/aztec/core';
import { EmbeddedAztecWallet } from '../services/aztec/core';
import { AztecDripperService, AztecTokenService } from '../services';
import { isValidConfig } from '../utils';
import { Account } from '@aztec/aztec.js/account';

interface AztecWalletContextType {
  // State
  wallet: EmbeddedAztecWallet | null;
  connectedAccount: Account | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Contract services
  dripperService: AztecDripperService | null;
  tokenService: AztecTokenService | null;
  bridgeService: any | null;

  // Actions
  createAccount: () => Promise<void>;
  connectTestAccount: (index: number) => Promise<void>;
  connectExistingAccount: () => Promise<void>;
  disconnectWallet: () => void;
  reinitialize: () => Promise<void>;
}

export const AztecWalletContext = createContext<
  AztecWalletContextType | undefined
>(undefined);

interface AztecWalletProviderProps {
  children: ReactNode;
}

export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({
  children,
}) => {
  // Wallet state
  const [wallet, setWallet] = useState<EmbeddedAztecWallet | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<Account | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Service state
  const [dripperService, setDripperService] = useState<AztecDripperService | null>(null);
  const [tokenService, setTokenService] = useState<AztecTokenService | null>(null);
  const [bridgeService, setBridgeService] = useState<any | null>(null);

  // Refs
  const walletRef = useRef<EmbeddedAztecWallet | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();
  const { addMessage } = useError();

  // Initialize wallet on config change
  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('🔄 Initialization already in progress, skipping');
      return;
    }

    if (!isValidConfig(config)) {
      console.warn('⚠️ Network not ready, switching to default network:', config.name);

      if (config.name !== DEFAULT_NETWORK.name) {
        console.log('🔄 Switching to default network due to bad configuration');
        resetToDefault();
        return;
      }

      console.error('❌ Default network is not ready - this should not happen');
      return;
    }

    if (isInitialized) {
      handleNetworkSwitch();
    }

    handleAutoInitialize();
  }, [config]);

  // Initialize services when account connects
  useEffect(() => {
    if (connectedAccount && isInitialized && walletRef.current) {
      handleAccountConnection();
    }
  }, [connectedAccount, isInitialized]);

  /**
   * Initialize services once account is connected
   */
  const handleAccountConnection = async () => {
    if (!walletRef.current) {
      return;
    }

    try {
      const services = await initializeServices(walletRef.current, config);

      setDripperService(services.dripperService);
      setTokenService(services.tokenService);
      setBridgeService(services.bridgeService);
    } catch (error) {
      console.error('Failed to initialize services:', error);
      addMessage({
        type: 'error',
        message: `Failed to initialize services: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  /**
   * Clear state when switching networks
   */
  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setBridgeService(null);
    setIsInitialized(false);
    setWallet(null);
    walletRef.current = null;

    isInitializingRef.current = false;
  };

  /**
   * Initialize wallet on app startup
   */
  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;

      await executeAsync(async () => {
        // Initialize wallet
        const { wallet: initializedWallet } = await initializeWallet(
          config.nodeUrl,
          config
        );

        walletRef.current = initializedWallet;
        setWallet(initializedWallet);
        setIsInitialized(true);
      }, 'initialize wallet');
    } catch (err) {
      console.error('Wallet initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  /**
   * Create a new account with deterministic credentials (hola/1337)
   */
  const handleCreateAccount = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }

      // Create and deploy account
      await walletRef.current.createAccountAndConnect();

      setConnectedAccount(walletRef.current.getConnectedAccount());
    }, 'create account');
  };

  /**
   * Connect to a test account by index (for development)
   */
  const handleConnectTestAccount = async (index: number): Promise<void> => {
    return executeAsync(async () => {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }

      await walletRef.current.connectTestAccount(index);
      setConnectedAccount(walletRef.current.getConnectedAccount());
    }, 'connect test account');
  };

  /**
   * Connect to existing account from localStorage
   */
  const handleConnectExistingAccount = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }

      if (connectedAccount) {
        console.log('Account already connected, skipping connection');
        return;
      }

      const accountAddress = await walletRef.current.connectExistingAccount();

      if (!accountAddress) {
        console.log('No existing account found in storage');
        return;
      }

      // Deploy if not already deployed
      console.log('Deploying account if needed');
      await walletRef.current.deployAccount();

      setConnectedAccount(walletRef.current.getConnectedAccount());
    }, 'connect existing account');
  };

  /**
   * Disconnect wallet and clear services
   */
  const disconnectWallet = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setBridgeService(null);

    if (walletRef.current) {
      walletRef.current.clearConnectedAccount();
    }
  };

  /**
   * Reinitialize wallet and services
   */
  const reinitialize = async () => {
    return executeAsync(async () => {
      // Clear existing state
      handleNetworkSwitch();

      // Reinitialize wallet
      const { wallet: initializedWallet } = await initializeWallet(
        config.nodeUrl,
        config
      );

      walletRef.current = initializedWallet;
      setWallet(initializedWallet);
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const contextValue: AztecWalletContextType = {
    wallet,
    connectedAccount,
    isInitialized,
    isLoading,
    error,
    dripperService,
    tokenService,
    bridgeService,
    createAccount: handleCreateAccount,
    connectTestAccount: handleConnectTestAccount,
    connectExistingAccount: handleConnectExistingAccount,
    disconnectWallet,
    reinitialize,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};

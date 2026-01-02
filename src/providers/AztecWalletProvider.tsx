import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useAsyncOperation, useConfig } from '../hooks';
import { DEFAULT_NETWORK } from '../config/networks';
import { initializeWallet, initializeServices } from '../services/aztec/core';
import { EmbeddedAztecWallet } from '../services/aztec/core';
import {
  AztecDripperService,
  AztecTokenService,
  AztecSendersService,
} from '../services';
import { isValidConfig } from '../utils';
import { Account } from '@aztec/aztec.js/account';
import { toastService } from '../services/toastService';

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
  sendersService: AztecSendersService | null;

  // Actions
  createAccount: () => Promise<void>;
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
  const [connectedAccount, setConnectedAccount] = useState<Account | null>(
    null
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Service state
  const [dripperService, setDripperService] =
    useState<AztecDripperService | null>(null);
  const [tokenService, setTokenService] = useState<AztecTokenService | null>(
    null
  );
  const [bridgeService, setBridgeService] = useState<any | null>(null);
  const [sendersService, setSendersService] =
    useState<AztecSendersService | null>(null);

  // Refs
  const walletRef = useRef<EmbeddedAztecWallet | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();

  // Initialize wallet on config change
  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('🔄 Initialization already in progress, skipping');
      return;
    }

    if (!isValidConfig(config)) {
      console.warn(
        '⚠️ Network not ready, switching to default network:',
        config.name
      );

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
      setSendersService(services.sendersService);
    } catch (error) {
      console.error('Failed to initialize services:', error);
      toastService.error(
        `Failed to initialize services: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
    setSendersService(null);
    setIsInitialized(false);
    setWallet(null);
    walletRef.current = null;

    isInitializingRef.current = false;
  };

  /**
   * Initialize wallet on app startup
   * This is a consolidated initialization that handles:
   * - PXE initialization
   * - Auto-connecting existing account
   * - Registering contracts for default tab
   */
  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;

      await executeAsync(async () => {
        // Initialize wallet (includes auto-connect and default tab contracts)
        const {
          wallet: initializedWallet,
          connectedAccount: autoConnectedAccount,
        } = await initializeWallet(
          config.nodeUrl,
          config,
          'mint' // Default tab
        );

        walletRef.current = initializedWallet;
        setWallet(initializedWallet);

        if (autoConnectedAccount) {
          setConnectedAccount(autoConnectedAccount);
        }

        setIsInitialized(true);
      }, 'initialize');
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
   * Disconnect wallet and clear services
   */
  const disconnectWallet = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setBridgeService(null);
    setSendersService(null);

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

      // Reinitialize wallet (includes auto-connect and default tab contracts)
      const {
        wallet: initializedWallet,
        connectedAccount: autoConnectedAccount,
      } = await initializeWallet(
        config.nodeUrl,
        config,
        'mint' // Default tab
      );

      walletRef.current = initializedWallet;
      setWallet(initializedWallet);

      if (autoConnectedAccount) {
        setConnectedAccount(autoConnectedAccount);
      }

      setIsInitialized(true);
    }, 'reinitialize');
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
    sendersService,
    createAccount: handleCreateAccount,
    disconnectWallet,
    reinitialize,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};

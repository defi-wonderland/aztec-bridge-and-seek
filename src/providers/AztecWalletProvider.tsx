import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import { useAsyncOperation, useConfig } from '../hooks';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import { initializeWalletServices, type WalletServices } from '../services/aztec/core';
import { AztecDripperService, AztecTokenService } from '../services';
import { isValidConfig } from '../utils';

interface AztecWalletContextType {
  // State
  connectedAccount: AccountWallet | null;
  isInitialized: boolean;
  isDeploying: boolean;
  isLoading: boolean;
  error: string | null;

  // Contract services
  dripperService: AztecDripperService | null;
  tokenService: AztecTokenService | null;

  // Actions
  createAccount: () => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedAccount, setConnectedAccount] =
    useState<AccountWallet | null>(null);
  const [dripperService, setDripperService] =
    useState<AztecDripperService | null>(null);
  const [tokenService, setTokenService] = useState<AztecTokenService | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();
  const { addMessage } = useError();

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

  useEffect(() => {
    if (connectedAccount && isInitialized && walletServicesRef.current) {
      recreateServices();
    }
  }, [connectedAccount, isInitialized]);

  const recreateServices = async () => {
    if (!walletServicesRef.current || !connectedAccount) return;

    // Services are now created during initialization with the connected account
    // Just set them from the wallet services
    setDripperService(walletServicesRef.current.dripperService);
    setTokenService(walletServicesRef.current.tokenService);
  };

  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setIsInitialized(false);
    
    isInitializingRef.current = false;
  };

  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;
      
      await executeAsync(async () => {
        const services = await initializeWalletServices(
          config.nodeUrl, 
          config, 
          () => connectedAccount
        );
        walletServicesRef.current = services;
        setIsInitialized(true);
      }, 'initialize wallet services');
    } catch (err) {
      console.error('App initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handleCreateAccount = async (): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      setIsDeploying(true);
      const wallet = await walletServicesRef.current.walletService.createAccount();
      setIsDeploying(false);
      
      setConnectedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await walletServicesRef.current.walletService.connectTestAccount(index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWallet | null> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      setIsDeploying(true);
      const wallet = await walletServicesRef.current.walletService.connectExistingAccount();
      
      if (wallet) setConnectedAccount(wallet);
      setIsDeploying(false);
      
      return wallet;
    }, 'connect existing account');
  };

  const disconnectWallet = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setIsDeploying(false);
    // Don't reset isInitialized - that's for app initialization, not wallet connection
    if (walletServicesRef.current) {
      walletServicesRef.current.walletService.clearAccount();
    }
  };

  const reinitialize = async () => {
    return executeAsync(async () => {
      const services = await initializeWalletServices(
        config.nodeUrl, 
        config, 
        () => connectedAccount
      );
      walletServicesRef.current = services;
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    isDeploying,
    dripperService,
    tokenService,
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

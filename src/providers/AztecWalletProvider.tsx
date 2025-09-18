import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import { useAsyncOperation, useConfig } from '../hooks';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import { 
  initializeCoreServices, 
  initializeAccountDependentServices,
  type CoreServices, 
  type WalletServices 
} from '../services/aztec/core';
import { AztecDripperService, AztecTokenService, AztecSendersService } from '../services';
import { isValidConfig } from '../utils';

interface AztecWalletContextType {
  // State
  connectedAccount: AccountWallet | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Contract services
  dripperService: AztecDripperService | null;
  tokenService: AztecTokenService | null;
  bridgeService: any | null;
  sendersService: AztecSendersService | null;

  // Actions
  createAccount: (password: string) => Promise<void>;
  connectTestAccount: (index: number) => Promise<void>;
  connectExistingAccount: (password?: string) => Promise<void>;
  disconnectWallet: () => void;
  reinitialize: () => Promise<void>;
  hasStoredAccount: () => boolean;
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
  const [bridgeService, setBridgeService] = useState<any | null>(null);
  const [sendersService, setSendersService] = useState<AztecSendersService | null>(null);

  const coreServicesRef = useRef<CoreServices | null>(null);
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
    if (connectedAccount && isInitialized && coreServicesRef.current) {
      handleAccountConnection();
    }
  }, [connectedAccount, isInitialized]);

  const handleAccountConnection = async () => {
    if (!coreServicesRef.current || !coreServicesRef.current.walletService.getConnectedAccount()) {
      return;
    }
    
    try {
      const accountServices = await initializeAccountDependentServices(
        coreServicesRef.current,
        config
      );
      
      setDripperService(accountServices.dripperService);
      setTokenService(accountServices.tokenService);
      setBridgeService(accountServices.bridgeService);
      setSendersService(accountServices.sendersService);
    } catch (error) {
      console.error('Failed to create account-dependent services:', error);
      addMessage({
        type: 'error',
        message: `Failed to initialize services: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };


  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setBridgeService(null);
    setSendersService(null);
    setIsInitialized(false);
    
    isInitializingRef.current = false;
  };

  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;
      
      await executeAsync(async () => {
        // Initialize core services first
        const coreServices = await initializeCoreServices(
          config.nodeUrl, 
          config
        );
        coreServicesRef.current = coreServices;
        setIsInitialized(true);

        // No auto-connect since we need password to decrypt stored data
      }, 'initialize core services');
    } catch (err) {
      console.error('Core services initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handleCreateAccount = async (password: string): Promise<void> => {
    return executeAsync(async () => {
      if (!coreServicesRef.current) {
        throw new Error('Core services not initialized');
      }

      // Create account without deploying
      await coreServicesRef.current.walletService.createAccount(password);
      const account = coreServicesRef.current.walletService.getConnectedAccount();
      
      setConnectedAccount(account);
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<void> => {
    return executeAsync(async () => {
      if (!coreServicesRef.current) {
        throw new Error('Core services not initialized');
      }

      await coreServicesRef.current.walletService.connectTestAccount(index);
      const account = coreServicesRef.current.walletService.getConnectedAccount();
      setConnectedAccount(account);
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (password?: string): Promise<void> => {
    return executeAsync(async () => {
      if (!coreServicesRef.current) {
        throw new Error('Core services not initialized');
      }

      if (connectedAccount) {
        console.log('Account already connected, skipping connection');
        return;
      }

      await coreServicesRef.current.walletService.connectExistingAccount(password);
      const account = coreServicesRef.current.walletService.getConnectedAccount();
      
      setConnectedAccount(account);
    }, 'connect existing account');
  };

  const hasStoredAccount = (): boolean => {
    return coreServicesRef.current?.walletService.getStorageService().hasStoredAccount() ?? false;
  };

  const disconnectWallet = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setBridgeService(null);
    setSendersService(null);
    // Don't reset isInitialized - that's for app initialization, not wallet connection
    if (coreServicesRef.current) {
      coreServicesRef.current.walletService.clearAccount();
    }
  };

  const reinitialize = async () => {
    return executeAsync(async () => {
      // Clear existing services
      setConnectedAccount(null);
      setDripperService(null);
      setTokenService(null);
      setBridgeService(null);
      setSendersService(null);
      
      // Reinitialize core services
      const coreServices = await initializeCoreServices(
        config.nodeUrl, 
        config
      );
      coreServicesRef.current = coreServices;
      setIsInitialized(true);
    }, 'reinitialize core services');
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    dripperService,
    tokenService,
    bridgeService,
    sendersService,
    createAccount: handleCreateAccount,
    connectTestAccount: handleConnectTestAccount,
    connectExistingAccount: handleConnectExistingAccount,
    disconnectWallet,
    reinitialize,
    hasStoredAccount,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};

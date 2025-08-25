import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import { useAsyncOperation, useConfig } from '../hooks';
import { DEFAULT_NETWORK } from '../config/networks';
import { initializeWalletServices, WalletServices, createWalletActionServices, createAccount, connectTestAccount, connectExistingAccount } from '../services/aztec/wallet';
import { AztecVotingService, AztecDripperService, AztecTokenService } from '../services';
import { validateConfig } from '../utils';

interface AztecWalletContextType {
  // State
  isInitialized: boolean;
  connectedAccount: AccountWallet | null;
  isLoading: boolean;
  error: string | null;
  
  // Contract services
  votingService: AztecVotingService | null;
  dripperService: AztecDripperService | null;
  tokenService: AztecTokenService | null;
  
  // Actions
  createAccount: (deploy: boolean) => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
  disconnectWallet: () => void;
  reinitialize: () => Promise<void>;
}

export const AztecWalletContext = createContext<AztecWalletContextType | undefined>(undefined);

interface AztecWalletProviderProps {
  children: ReactNode;
}

export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<AccountWallet | null>(null);
  const [votingService, setVotingService] = useState<AztecVotingService | null>(null);
  const [dripperService, setDripperService] = useState<AztecDripperService | null>(null);
  const [tokenService, setTokenService] = useState<AztecTokenService | null>(null);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();

  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('🔄 Initialization already in progress, skipping');
      return;
    }

    if (!validateConfig(config)) {
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

    const actionServices = createWalletActionServices(
      walletServicesRef.current,
      config,
      () => connectedAccount
    );

    setVotingService(actionServices.votingService);
    setDripperService(actionServices.dripperService);
    setTokenService(actionServices.tokenService);
  };

  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
    setVotingService(null);
    setDripperService(null);
    setTokenService(null);
    setIsInitialized(false);
    
    isInitializingRef.current = false;
  };

  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;
      
      await executeAsync(async () => {
        const services = await initializeWalletServices(config.nodeUrl, config);
        walletServicesRef.current = services;
        setIsInitialized(true);
      }, 'initialize wallet services');
    } catch (err) {
      console.error('App initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handleCreateAccount = async (deploy: boolean): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const result = await walletServicesRef.current.walletService.createEcdsaAccount(deploy);
      
      walletServicesRef.current.storageService.saveAccount({
        address: result.wallet.getAddress().toString(),
        signingKey: result.signingKey.toString('hex'),
        secretKey: result.secretKey.toString(),
        salt: result.salt.toString(),
      });

      setConnectedAccount(result.wallet);
      return result.wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectTestAccount(walletServicesRef.current.walletService, index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWallet | null> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectExistingAccount(
        walletServicesRef.current.walletService,
        walletServicesRef.current.storageService
      );

      if (wallet) {
        setConnectedAccount(wallet);
      }

      return wallet;
    }, 'connect existing account');
  };

  const disconnectWallet = () => {
    setConnectedAccount(null);
    setVotingService(null);
    setDripperService(null);
    setTokenService(null);
    if (walletServicesRef.current) {
      walletServicesRef.current.storageService.clearAccount();
    }
  };

  const reinitialize = async () => {
    return executeAsync(async () => {
      const services = await initializeWalletServices(config.nodeUrl, config);
      walletServicesRef.current = services;
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    votingService,
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



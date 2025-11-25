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
import { Fr } from '@aztec/aztec.js/fields';
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
  createAccountWithPasskey: (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ) => Promise<void>;
  connectAccountWithPasskey: (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ) => Promise<void>;
  connectTestAccount: (index: number) => Promise<void>;
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
   * Create a new account with passkey-derived credentials
   */
  const handleCreateAccountWithPasskey = async (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ): Promise<void> => {
    return executeAsync(async () => {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }

      // Create and deploy account with passkey credentials
      await walletRef.current.createAccountWithPasskey(
        secretKey,
        salt,
        signingKey
      );

      setConnectedAccount(walletRef.current.getConnectedAccount());
      toastService.success('Wallet created successfully!');
    }, 'create account with passkey');
  };

  /**
   * Connect to an existing account with passkey-derived credentials
   */
  const handleConnectAccountWithPasskey = async (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ): Promise<void> => {
    return executeAsync(async () => {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }

      // Connect account with passkey credentials
      await walletRef.current.connectAccountWithPasskey(
        secretKey,
        salt,
        signingKey
      );

      setConnectedAccount(walletRef.current.getConnectedAccount());
      toastService.success('Wallet connected successfully!');
    }, 'connect account with passkey');
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
    sendersService,
    createAccountWithPasskey: handleCreateAccountWithPasskey,
    connectAccountWithPasskey: handleConnectAccountWithPasskey,
    connectTestAccount: handleConnectTestAccount,
    disconnectWallet,
    reinitialize,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};

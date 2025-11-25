import React, { createContext, ReactNode } from 'react';
import { useConfig } from '../hooks';
import { DEFAULT_NETWORK } from '../config/networks';
import { EmbeddedAztecWallet } from '../services/aztec/core';
import {
  AztecDripperService,
  AztecTokenService,
  AztecSendersService,
} from '../services';
import { isValidConfig } from '../utils';
import { Account } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import { usePasskeyWallet } from '../hooks/usePasskeyWallet';

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
  const { currentConfig: config, resetToDefault } = useConfig();

  // Validate config and switch to default if needed
  if (!isValidConfig(config)) {
    console.warn('⚠️ Network not ready, switching to default network:', config.name);
    if (config.name !== DEFAULT_NETWORK.name) {
      console.log('🔄 Switching to default network due to bad configuration');
      resetToDefault();
    }
  }

  // Use the passkey wallet hook
  const {
    wallet,
    account: connectedAccount,
    isInitialized,
    isConnecting,
    error,
    services,
    createWalletWithPasskey,
    connectWalletWithPasskey,
    disconnect,
  } = usePasskeyWallet({
    nodeUrl: config.nodeUrl,
    config,
    autoInitialize: isValidConfig(config),
  });

  /**
   * Connect to a test account by index (for development)
   */
  const connectTestAccount = async (index: number): Promise<void> => {
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }

    await wallet.connectTestAccount(index);
    // Note: The hook doesn't automatically update when using test accounts
    // This is a legacy feature mainly for development
  };

  /**
   * Create account with passkey - wrapper for the hook method
   */
  const createAccountWithPasskey = async (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ): Promise<void> => {
    // The hook handles this internally via createWalletWithPasskey
    // This is kept for backward compatibility
    await createWalletWithPasskey();
  };

  /**
   * Connect account with passkey - wrapper for the hook method
   */
  const connectAccountWithPasskey = async (
    secretKey: Fr,
    salt: Fr,
    signingKey: Buffer,
    credentialId: string
  ): Promise<void> => {
    // The hook handles this internally via connectWalletWithPasskey
    // This is kept for backward compatibility
    await connectWalletWithPasskey();
  };

  /**
   * Disconnect wallet - wrapper for the hook method
   */
  const disconnectWallet = () => {
    disconnect();
  };

  /**
   * Reinitialize wallet and services
   * TODO: This may need to be implemented in the hook
   */
  const reinitialize = async () => {
    // For now, just reload the page
    window.location.reload();
  };

  const contextValue: AztecWalletContextType = {
    wallet,
    connectedAccount,
    isInitialized,
    isLoading: isConnecting,
    error,
    dripperService: services.dripper,
    tokenService: services.token,
    bridgeService: services.bridge,
    sendersService: services.senders,
    createAccountWithPasskey,
    connectAccountWithPasskey,
    connectTestAccount,
    disconnectWallet,
    reinitialize,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};

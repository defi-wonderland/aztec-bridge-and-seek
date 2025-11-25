import { useState, useEffect, useRef } from 'react';
import { Account } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import {
  initializeWallet,
  initializeServices,
  registerContracts,
  EmbeddedAztecWallet,
} from '../services/aztec/core';
import {
  AztecDripperService,
  AztecTokenService,
  AztecSendersService,
} from '../services';
import { PasskeyService } from '../services/passkey/PasskeyService';
import { toastService } from '../services/toastService';
import { AppConfig } from '../config/networks';

/**
 * Configuration for the passkey wallet hook
 */
export interface UsePasskeyWalletConfig {
  /** URL of the Aztec node */
  nodeUrl: string;
  /** Application configuration with contract addresses */
  config: AppConfig;
  /** Whether to automatically initialize wallet on mount (default: true) */
  autoInitialize?: boolean;
  /** Callback when account is successfully connected */
  onAccountConnected?: (account: Account) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Services available after wallet connection
 */
export interface PasskeyWalletServices {
  dripper: AztecDripperService | null;
  token: AztecTokenService | null;
  bridge: any | null;
  senders: AztecSendersService | null;
}

/**
 * Return type for the passkey wallet hook
 */
export interface UsePasskeyWalletReturn {
  // Core wallet state
  wallet: EmbeddedAztecWallet | null;
  account: Account | null;
  isInitialized: boolean;
  isConnecting: boolean;
  error: string | null;

  // Services (available after connection)
  services: PasskeyWalletServices;

  // Actions
  createWalletWithPasskey: () => Promise<void>;
  connectWalletWithPasskey: () => Promise<void>;
  disconnect: () => void;

  // Utilities
  hasExistingPasskeys: () => Promise<boolean>;
  isPasskeySupported: boolean;
}

/**
 * A comprehensive hook for managing Aztec wallets with passkey authentication.
 *
 * This hook encapsulates:
 * - Wallet initialization and PXE setup
 * - Passkey-based account creation and connection
 * - Contract registration
 * - Service initialization
 * - State management and error handling
 *
 * @example
 * ```typescript
 * const {
 *   wallet,
 *   account,
 *   isInitialized,
 *   createWalletWithPasskey,
 *   connectWalletWithPasskey,
 * } = usePasskeyWallet({
 *   nodeUrl: 'https://api.aztec.network',
 *   config: networkConfig,
 * });
 * ```
 */
export const usePasskeyWallet = ({
  nodeUrl,
  config,
  autoInitialize = true,
  onAccountConnected,
  onError,
}: UsePasskeyWalletConfig): UsePasskeyWalletReturn => {
  // Wallet state
  const [wallet, setWallet] = useState<EmbeddedAztecWallet | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Service state
  const [services, setServices] = useState<PasskeyWalletServices>({
    dripper: null,
    token: null,
    bridge: null,
    senders: null,
  });

  // Refs to prevent re-initialization
  const walletRef = useRef<EmbeddedAztecWallet | null>(null);
  const isInitializingRef = useRef(false);
  const contractsRegisteredRef = useRef(false);

  /**
   * Initialize the wallet and PXE on mount
   */
  useEffect(() => {
    if (!autoInitialize || isInitializingRef.current) {
      return;
    }

    const initialize = async () => {
      try {
        isInitializingRef.current = true;

        const { wallet: initializedWallet } = await initializeWallet(
          nodeUrl,
          config
        );

        walletRef.current = initializedWallet;
        setWallet(initializedWallet);
        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Wallet initialization failed';
        setError(errorMessage);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    initialize();
  }, [nodeUrl, config, autoInitialize, onError]);

  /**
   * Initialize services when account is connected
   */
  useEffect(() => {
    if (!account || !isInitialized || !walletRef.current) {
      return;
    }

    const initServices = async () => {
      try {
        // Register contracts first (only once)
        if (!contractsRegisteredRef.current) {
          await registerContracts(walletRef.current!, config);
          contractsRegisteredRef.current = true;
        }

        // Initialize services
        const initializedServices = await initializeServices(
          walletRef.current!,
          config
        );

        setServices({
          dripper: initializedServices.dripperService,
          token: initializedServices.tokenService,
          bridge: initializedServices.bridgeService,
          senders: initializedServices.sendersService,
        });

        // Notify callback
        if (onAccountConnected) {
          onAccountConnected(account);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Service initialization failed';
        setError(errorMessage);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    initServices();
  }, [account, isInitialized, config, onAccountConnected, onError]);

  /**
   * Create a new wallet with passkey authentication
   */
  const createWalletWithPasskey = async (): Promise<void> => {
    if (!walletRef.current) {
      const err = new Error('Wallet not initialized');
      setError(err.message);
      if (onError) onError(err);
      throw err;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Check passkey support
      if (!PasskeyService.isPasskeySupported()) {
        throw new Error(
          'Passkeys are not supported in your browser. Please use a modern browser like Chrome, Safari, or Edge.'
        );
      }

      // Create passkey and derive credentials
      const credentials = await PasskeyService.createWalletWithPasskey();

      // Create and deploy account
      await walletRef.current.createAccountWithPasskey(
        credentials.secretKey,
        credentials.salt,
        credentials.signingKey
      );

      // Update state
      const connectedAccount = walletRef.current.getConnectedAccount();
      setAccount(connectedAccount);

      toastService.success('Wallet created successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(errorMessage);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Connect to an existing wallet with passkey authentication
   */
  const connectWalletWithPasskey = async (): Promise<void> => {
    if (!walletRef.current) {
      const err = new Error('Wallet not initialized');
      setError(err.message);
      if (onError) onError(err);
      throw err;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Check passkey support
      if (!PasskeyService.isPasskeySupported()) {
        throw new Error(
          'Passkeys are not supported in your browser. Please use a modern browser like Chrome, Safari, or Edge.'
        );
      }

      // Authenticate with passkey and retrieve credentials
      const credentials = await PasskeyService.connectWalletWithPasskey();

      if (!credentials) {
        throw new Error('No wallet found. Please create a new wallet first.');
      }

      // Connect to existing account
      await walletRef.current.connectAccountWithPasskey(
        credentials.secretKey,
        credentials.salt,
        credentials.signingKey
      );

      // Update state
      const connectedAccount = walletRef.current.getConnectedAccount();
      setAccount(connectedAccount);

      toastService.success('Wallet connected successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect the current wallet and clear state
   */
  const disconnect = (): void => {
    setAccount(null);
    setServices({
      dripper: null,
      token: null,
      bridge: null,
      senders: null,
    });

    if (walletRef.current) {
      walletRef.current.clearConnectedAccount();
    }
  };

  /**
   * Check if there are existing passkeys stored
   */
  const hasExistingPasskeys = async (): Promise<boolean> => {
    return PasskeyService.hasExistingPasskeys();
  };

  /**
   * Check if passkeys are supported in the current browser
   */
  const isPasskeySupported = PasskeyService.isPasskeySupported();

  return {
    // State
    wallet,
    account,
    isInitialized,
    isConnecting,
    error,
    services,

    // Actions
    createWalletWithPasskey,
    connectWalletWithPasskey,
    disconnect,

    // Utilities
    hasExistingPasskeys,
    isPasskeySupported,
  };
};

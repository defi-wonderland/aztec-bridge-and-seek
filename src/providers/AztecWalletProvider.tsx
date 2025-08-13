import React, { createContext, useContext, useState, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import {
  AztecStorageService,
  AztecWalletService,
  AztecContractService,
  AztecVotingService,
} from '../services';
import { useAsyncOperation } from '../hooks';

interface AztecWalletContextType {
  // State
  isInitialized: boolean;
  connectedAccount: AccountWallet | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: (nodeUrl: string) => Promise<void>;
  createAccount: () => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
  registerContract: (
    artifact: any,
    deployer: string,
    deploymentSalt: string,
    constructorArgs: any[]
  ) => Promise<void>;
  sendTransaction: (interaction: any) => Promise<void>;
  simulateTransaction: (interaction: any) => Promise<any>;
  getConnectedAccount: () => AccountWallet | null;
}

export const AztecWalletContext = createContext<AztecWalletContextType | undefined>(undefined);

interface AztecWalletProviderProps {
  children: ReactNode;
}

export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<AccountWallet | null>(null);

  // Service instances
  const [walletService, setWalletService] = useState<AztecWalletService | null>(null);
  const [contractService, setContractService] = useState<AztecContractService | null>(null);
  const [votingService, setVotingService] = useState<AztecVotingService | null>(null);
  const [storageService] = useState(() => new AztecStorageService());

  // Use the custom hook for async operations
  const { isLoading, error, executeAsync } = useAsyncOperation();

  const initialize = async (nodeUrl: string) => {
    return executeAsync(async () => {
      // Initialize wallet service
      const newWalletService = new AztecWalletService();
      await newWalletService.initialize(nodeUrl);
      setWalletService(newWalletService);

      // Initialize contract service
      const newContractService = new AztecContractService(newWalletService.getPXE());
      setContractService(newContractService);

      // Initialize voting service
      const newVotingService = new AztecVotingService(
        () => newWalletService.getSponsoredPFCContract()
      );
      setVotingService(newVotingService);

      setIsInitialized(true);
    }, 'initialize wallet');
  };

  const createAccount = async (): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletService) {
        throw new Error('Wallet service not initialized');
      }

      const result = await walletService.createEcdsaAccount();
      
      // Store the account in local storage
      storageService.saveAccount({
        address: result.wallet.getAddress().toString(),
        signingKey: result.signingKey.toString('hex'),
        secretKey: result.secretKey.toString(),
        salt: result.salt.toString(),
      });

      setConnectedAccount(result.wallet);
      return result.wallet;
    }, 'create account');
  };

  const connectTestAccount = async (index: number): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletService) {
        throw new Error('Wallet service not initialized');
      }

      const wallet = await walletService.connectTestAccount(index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const connectExistingAccount = async (): Promise<AccountWallet | null> => {
    return executeAsync(async () => {
      if (!walletService) {
        throw new Error('Wallet service not initialized');
      }

      const account = storageService.getAccount();
      if (!account) {
        return null;
      }

      const ecdsaWallet = await walletService.createEcdsaAccountFromCredentials(
        // Note: We need to import Fr to convert strings back to Fr objects
        // For now, we'll use a simple approach
        account.secretKey as any,
        Buffer.from(account.signingKey, 'hex'),
        account.salt as any
      );

      setConnectedAccount(ecdsaWallet);
      return ecdsaWallet;
    }, 'connect existing account');
  };

  const registerContract = async (
    artifact: any,
    deployer: string,
    deploymentSalt: string,
    constructorArgs: any[]
  ): Promise<void> => {
    return executeAsync(async () => {
      if (!contractService) {
        throw new Error('Contract service not initialized');
      }

      // Note: We need to import Fr and AztecAddress to convert strings
      // For now, we'll use a simple approach
      await contractService.registerContract(
        artifact,
        deployer as any,
        deploymentSalt as any,
        constructorArgs
      );
    }, 'register contract');
  };

  const sendTransaction = async (interaction: any): Promise<void> => {
    return executeAsync(async () => {
      if (!votingService) {
        throw new Error('Voting service not initialized');
      }

      await votingService.sendTransaction(interaction);
    }, 'send transaction');
  };

  const simulateTransaction = async (interaction: any): Promise<any> => {
    return executeAsync(async () => {
      if (!votingService) {
        throw new Error('Voting service not initialized');
      }

      return await votingService.simulateTransaction(interaction);
    }, 'simulate transaction');
  };

  const getConnectedAccount = (): AccountWallet | null => {
    return connectedAccount;
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    initialize,
    createAccount,
    connectTestAccount,
    connectExistingAccount,
    registerContract,
    sendTransaction,
    simulateTransaction,
    getConnectedAccount,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};



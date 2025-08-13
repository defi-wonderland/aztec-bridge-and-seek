import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet, AztecAddress, Fr } from '@aztec/aztec.js';
import {
  AztecStorageService,
  AztecWalletService,
  AztecContractService,
  AztecVotingService,
} from '../services';
import { useAsyncOperation } from '../hooks';
import { EasyPrivateVotingContract } from '../artifacts/EasyPrivateVoting';
import { getEnv } from '../config';

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

  const [walletService, setWalletService] = useState<AztecWalletService | null>(null);
  const [contractService, setContractService] = useState<AztecContractService | null>(null);
  const [votingService, setVotingService] = useState<AztecVotingService | null>(null);
  const [storageService] = useState(() => new AztecStorageService());

  const { isLoading, error, executeAsync } = useAsyncOperation();

  const config = getEnv();

  const initializationStartedRef = useRef(false);

  useEffect(() => {
    if (!isInitialized && !initializationStartedRef.current) {
      initializationStartedRef.current = true;
      handleAutoInitialize();
    }
  }, [isInitialized]);

  // TODO: remove the logs here and in the initialize function
  const handleAutoInitialize = async () => {
    try {
      console.log('🚀 Auto-initializing Aztec wallet...');
      
      await initialize(config.AZTEC_NODE_URL);
      console.log('✅ App initialization complete!');
    } catch (err) {
      console.error('❌ App initialization failed:', err);
    }
  };

  const initialize = async (nodeUrl: string) => {
    return executeAsync(async () => {
      const newWalletService = new AztecWalletService();
      await newWalletService.initialize(nodeUrl);
      setWalletService(newWalletService);

      const newContractService = new AztecContractService(newWalletService.getPXE());
      setContractService(newContractService);

      const newVotingService = new AztecVotingService(
        () => newWalletService.getSponsoredFeePaymentMethod()
      );
      setVotingService(newVotingService);

      console.log('📝 Registering voting contract...');
      try {
        const deployerAddress = AztecAddress.fromString(config.DEPLOYER_ADDRESS);
        const deploymentSalt = Fr.fromString(config.DEPLOYMENT_SALT);
        
        await newContractService.registerContract(
          EasyPrivateVotingContract.artifact,
          deployerAddress,
          deploymentSalt,
          [deployerAddress] // Constructor args
        );
        console.log('✅ Voting contract registered');
      } catch (err) {
        console.error('❌ Failed to register voting contract:', err);
        throw err;
      }

      setIsInitialized(true);
    }, 'initialize wallet');
  };

  const createAccount = async (): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletService) {
        throw new Error('Wallet service not initialized');
      }

      const result = await walletService.createEcdsaAccount();
      
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



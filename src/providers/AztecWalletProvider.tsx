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
  
  // Services
  votingService: AztecVotingService | null;
  
  // Actions
  createAccount: () => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
}

export const AztecWalletContext = createContext<AztecWalletContextType | undefined>(undefined);

interface AztecWalletProviderProps {
  children: ReactNode;
}

export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<AccountWallet | null>(null);
  const [votingService, setVotingService] = useState<AztecVotingService | null>(null);

  const walletServiceRef = useRef<AztecWalletService | null>(null);
  const contractServiceRef = useRef<AztecContractService | null>(null);
  const storageServiceRef = useRef<AztecStorageService | null>(null);

  const { isLoading, error, executeAsync } = useAsyncOperation();

  const config = getEnv();

  const initializationStartedRef = useRef(false);

  useEffect(() => {
    if (!isInitialized && !initializationStartedRef.current) {
      initializationStartedRef.current = true;
      handleAutoInitialize();
    }
  }, [isInitialized]);

  // Create or recreate voting service when account changes to ensure it has the current account
  useEffect(() => {
    if (connectedAccount && isInitialized && walletServiceRef.current) {
      const newVotingService = new AztecVotingService(
        () => walletServiceRef.current!.getSponsoredFeePaymentMethod(),
        config.CONTRACT_ADDRESS,
        () => connectedAccount
      );
      setVotingService(newVotingService);
    }
  }, [connectedAccount, config.CONTRACT_ADDRESS, isInitialized]);

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
      // Initialize storage service first
      if (!storageServiceRef.current) {
        storageServiceRef.current = new AztecStorageService();
      }

      if (!walletServiceRef.current) {
        const newWalletService = new AztecWalletService();
        await newWalletService.initialize(nodeUrl);
        walletServiceRef.current = newWalletService;
      }

      if (!contractServiceRef.current) {
        const newContractService = new AztecContractService(walletServiceRef.current!.getPXE());
        contractServiceRef.current = newContractService;
      }

      console.log('📝 Registering voting contract...');
      try {
        const deployerAddress = AztecAddress.fromString(config.DEPLOYER_ADDRESS);
        const deploymentSalt = Fr.fromString(config.DEPLOYMENT_SALT);
        
        await contractServiceRef.current!.registerContract(
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
      if (!walletServiceRef.current) {
        throw new Error('Wallet service not initialized');
      }

      const result = await walletServiceRef.current.createEcdsaAccount();
      
      storageServiceRef.current!.saveAccount({
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
      if (!walletServiceRef.current) {
        throw new Error('Wallet service not initialized');
      }

      const wallet = await walletServiceRef.current.connectTestAccount(index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const connectExistingAccount = async (): Promise<AccountWallet | null> => {
    return executeAsync(async () => {
      if (!walletServiceRef.current) {
        throw new Error('Wallet service not initialized');
      }

      const account = storageServiceRef.current!.getAccount();
      if (!account) {
        return null;
      }

      const ecdsaWallet = await walletServiceRef.current.createEcdsaAccountFromCredentials(
        account.secretKey as any,
        Buffer.from(account.signingKey, 'hex'),
        account.salt as any
      );

      setConnectedAccount(ecdsaWallet);
      return ecdsaWallet;
    }, 'connect existing account');
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    votingService,
    createAccount,
    connectTestAccount,
    connectExistingAccount,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};



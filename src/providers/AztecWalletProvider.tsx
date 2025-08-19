import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet, AztecAddress, Fr } from '@aztec/aztec.js';
import {
  AztecStorageService,
  AztecWalletService,
  AztecContractService,
  AztecVotingService,
  AztecDripperService,
  AztecTokenService,
} from '../services';
import { useAsyncOperation } from '../hooks';
import { EasyPrivateVotingContract } from '../artifacts/EasyPrivateVoting';
import { DripperContract } from '../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/Token.js';
import { getEnv } from '../config';

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
  createAccount: () => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
  disconnectWallet: () => void;
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

  // Create or recreate services when account changes to ensure they have the current account
  useEffect(() => {
    if (connectedAccount && isInitialized && walletServiceRef.current) {
      const newVotingService = new AztecVotingService(
        () => walletServiceRef.current!.getSponsoredFeePaymentMethod(),
        config.VOTING_CONTRACT_ADDRESS,
        () => connectedAccount
      );
      setVotingService(newVotingService);

      const newDripperService = new AztecDripperService(
        () => walletServiceRef.current!.getSponsoredFeePaymentMethod(),
        config.DRIPPER_CONTRACT_ADDRESS,
        () => connectedAccount
      );
      setDripperService(newDripperService);

      const newTokenService = new AztecTokenService(
        () => connectedAccount
      );
      setTokenService(newTokenService);
    }
  }, [connectedAccount, config.VOTING_CONTRACT_ADDRESS, config.DRIPPER_CONTRACT_ADDRESS, isInitialized]);

  // TODO: remove the logs here and in the initialize function
  const handleAutoInitialize = async () => {
    try {
      await initialize(config.AZTEC_NODE_URL);
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

      try {
        const deployerAddress = AztecAddress.fromString(config.DEPLOYER_ADDRESS);
        const deploymentSalt = Fr.fromString(config.VOTING_DEPLOYMENT_SALT);
        
        await contractServiceRef.current!.registerContract(
          EasyPrivateVotingContract.artifact,
          deployerAddress,
          deploymentSalt,
          [deployerAddress] // Constructor args
        );
      } catch (err) {
        console.error('❌ Failed to register voting contract:', err);
        throw err;
      }

      try {
        const dripperDeployerAddress = AztecAddress.fromString(config.DEPLOYER_ADDRESS);
        const dripperDeploymentSalt = Fr.fromString(config.DRIPPER_DEPLOYMENT_SALT);
        
        await contractServiceRef.current!.registerContract(
          DripperContract.artifact,
          dripperDeployerAddress,
          dripperDeploymentSalt,
          [] // No constructor args for Dripper
        );
      } catch (err) {
        console.error('❌ Failed to register Dripper contract:', err);
        throw err;
      }

      try {
        const tokenDeployerAddress = AztecAddress.fromString(config.DEPLOYER_ADDRESS);
        const tokenDeploymentSalt = Fr.fromString(config.TOKEN_DEPLOYMENT_SALT);

        await contractServiceRef.current!.registerContract(
          TokenContract.artifact,
          tokenDeployerAddress,
          tokenDeploymentSalt,
          [
            "Yield Token", // name
            "YT", // symbol
            18, // decimals
            AztecAddress.fromString(config.DRIPPER_CONTRACT_ADDRESS), // minter (Dripper address)
            AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
          ],
          'constructor_with_minter' // Pass the specific constructor artifact
        );
      } catch (err) {
        console.error('❌ Failed to register Token contract:', err);
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

  const disconnectWallet = () => {
    setConnectedAccount(null);
    setVotingService(null);
    setDripperService(null);
    setTokenService(null);
    // Don't reset isInitialized - that's for app initialization, not wallet connection
    storageServiceRef.current!.clearAccount();
  };

  const contextValue: AztecWalletContextType = {
    isInitialized,
    connectedAccount,
    isLoading,
    error,
    votingService,
    dripperService,
    tokenService,
    createAccount,
    connectTestAccount,
    connectExistingAccount,
    disconnectWallet,
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};



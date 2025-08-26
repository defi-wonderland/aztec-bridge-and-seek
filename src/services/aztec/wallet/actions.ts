import { type AccountWallet, Fr } from '@aztec/aztec.js';
import { AztecWalletService, AztecContractService } from '../core';
import { AztecVotingService, AztecDripperService, AztecTokenService } from '../features';
import { AztecStorageService } from '../storage';
import { WalletServices } from './initialization';
import { AppConfig } from '../../../config/networks';

export interface WalletActionServices {
  votingService: AztecVotingService;
  dripperService: AztecDripperService;
  tokenService: AztecTokenService;
}

export const createWalletActionServices = (
  walletServices: WalletServices,
  config: AppConfig,
  getConnectedAccount: () => AccountWallet | null
): WalletActionServices => {
  const votingService = new AztecVotingService(
    () => walletServices.walletService.getSponsoredFeePaymentMethod(),
    config.contractAddress,
    getConnectedAccount
  );

  const dripperService = new AztecDripperService(
    () => walletServices.walletService.getSponsoredFeePaymentMethod(),
    config.dripperContractAddress,
    getConnectedAccount
  );

  const tokenService = new AztecTokenService(getConnectedAccount);

  return {
    votingService,
    dripperService,
    tokenService,
  };
};

export const createAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: (message: any) => void,
  config?: AppConfig
): Promise<AccountWallet> => {
  // 1. Create account locally (wallet service responsibility)
  const result = await walletServices.walletService.createEcdsaAccount();
  
  // 2. Save to storage (storage service responsibility)
  walletServices.storageService.clearAccount();
  walletServices.storageService.saveAccount({
    address: result.wallet.getAddress().toString(),
    signingKey: result.signingKey.toString('hex'),
    secretKey: result.secretKey.toString(),
    salt: result.salt.toString(),
  });

  // 3. Deploy using dedicated deployment service (deployment service responsibility)
  if (typeof Worker !== 'undefined' && setIsDeploying) {
    setIsDeploying(true);
    
    try {
      walletServices.deployService.deployNewAccount(
        result,
        {
          onSuccess: (txHash) => {
            console.log('✅ Account deployed successfully', txHash);
            setIsDeploying(false);
            
            // Message creation belongs in actions (UI orchestration)
            if (addMessage) {
              addMessage({
                message: 'Account deployed successfully',
                type: 'success',
                source: 'wallet',
                details: txHash ? `Tx: ${txHash}` : undefined,
              });
            }
          },
          onError: (error) => {
            console.error('❌ Failed to deploy account:', error);
            setIsDeploying(false);
            
            // Message creation belongs in actions (UI orchestration)
            if (addMessage) {
              addMessage({
                message: 'Failed to deploy account',
                type: 'error',
                source: 'wallet',
                details: error,
              });
            }
          },
        }
      );
    } catch (serviceError) {
      console.error('❌ Failed to initialize deployment service:', serviceError);
      setIsDeploying(false);
    }
  }

  return result.wallet;
};

export const connectTestAccount = async (
  walletService: AztecWalletService,
  index: number
): Promise<AccountWallet> => {
  return await walletService.connectTestAccount(index);
};

export const connectExistingAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: (message: any) => void,
  config?: AppConfig
): Promise<AccountWallet | null> => {
  const account = walletServices.storageService.getAccount();
  if (!account) {
    return null;
  }

  // 1. Create wallet from existing credentials (wallet service responsibility)
  const wallet = await walletServices.walletService.createEcdsaAccountFromCredentials(
    Fr.fromString(account.secretKey),
    Buffer.from(account.signingKey, 'hex'),
    Fr.fromString(account.salt)
  );

  // 2. Deploy using dedicated deployment service (deployment service responsibility)
  if (typeof Worker !== 'undefined' && setIsDeploying) {
    setIsDeploying(true);
    
    try {
      walletServices.deployService.deployExistingAccount(
        {
          secretKey: account.secretKey,
          signingKey: account.signingKey,
          salt: account.salt,
        },
        {
          onSuccess: (txHash) => {
            console.log('✅ Existing account deployed successfully', txHash);
            setIsDeploying(false);
            
            // Message creation belongs in actions (UI orchestration)
            if (addMessage) {
              addMessage({
                message: 'Existing account deployed successfully',
                type: 'success',
                source: 'wallet',
                details: txHash ? `Tx: ${txHash}` : undefined,
              });
            }
          },
          onError: (error) => {
            console.error('❌ Failed to deploy existing account:', error);
            setIsDeploying(false);
            
            // Message creation belongs in actions (UI orchestration)
            if (addMessage) {
              addMessage({
                message: 'Failed to deploy existing account',
                type: 'error',
                source: 'wallet',
                details: error,
              });
            }
          },
        }
      );
    } catch (serviceError) {
      console.error('❌ Failed to initialize deployment service:', serviceError);
      setIsDeploying(false);
    }
  }

  return wallet;
};

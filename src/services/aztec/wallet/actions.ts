import { type AccountWallet } from '@aztec/aztec.js';
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

export const createAccount = async (walletService: AztecWalletService): Promise<AccountWallet> => {
  const result = await walletService.createEcdsaAccount();
  return result.wallet;
};

export const connectTestAccount = async (
  walletService: AztecWalletService,
  index: number
): Promise<AccountWallet> => {
  return await walletService.connectTestAccount(index);
};

export const connectExistingAccount = async (
  walletService: AztecWalletService,
  storageService: AztecStorageService
): Promise<AccountWallet | null> => {
  const account = storageService.getAccount();
  if (!account) {
    return null;
  }

  return await walletService.createEcdsaAccountFromCredentials(
    account.secretKey as any,
    Buffer.from(account.signingKey, 'hex'),
    account.salt as any
  );
};

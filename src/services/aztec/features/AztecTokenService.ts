import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Wallet } from '@aztec/aztec.js/wallet';
import { TokenContract as WonderTokenContract } from '../../../../src/artifacts/Token.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { logger } from '@aztec/foundation/log';

export interface ITokenService {
  getPrivateBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress, isTokenStandard: boolean): Promise<bigint>;
  getPublicBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress, isTokenStandard: boolean): Promise<bigint>;
}

/**
 * Service for handling Aztec Token operations
 * Uses a Wallet instance (EmbeddedAztecWallet via BaseWallet)
 */
export class AztecTokenService implements ITokenService {
  private contractCache = new Map<string, WonderTokenContract | AztecTokenContract>();

  constructor(
    private wallet: Wallet
  ) {}

  private async getTokenContract(
    tokenAddress: AztecAddress,
    isTokenStandard: boolean
  ): Promise<WonderTokenContract | AztecTokenContract> {
    const cacheKey = `${tokenAddress.toString()}_${isTokenStandard}`;
    
    if (!this.contractCache.has(cacheKey)) {
      logger.debug(`Creating new contract instance for ${tokenAddress.toString()}`);
      const tokenContractInterface = isTokenStandard ? WonderTokenContract : AztecTokenContract;
      const tokenContract = await tokenContractInterface.at(tokenAddress, this.wallet);
      this.contractCache.set(cacheKey, tokenContract);
    } else {
      logger.debug(`Using cached contract instance for ${tokenAddress.toString()}`);
    }
    
    return this.contractCache.get(cacheKey)!;
  }

  /**
   * Get private balance for a token
   */
  async getPrivateBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress, isTokenStandard: boolean): Promise<bigint> {
    logger.debug(`Fetching private balance for ${tokenAddress.toString().slice(0, 10)}...`);

    const tokenContract = await this.getTokenContract(tokenAddress, isTokenStandard);

    const balance = await tokenContract.methods.balance_of_private(ownerAddress).simulate({
      from: ownerAddress,
    });

    logger.debug(`✅ Private balance: ${balance}`);
    return balance;
  }

  /**
   * Get public balance for a token
   */
  async getPublicBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress, isTokenStandard: boolean): Promise<bigint> {
    logger.debug(`Fetching public balance for ${tokenAddress.toString().slice(0, 10)}...`);

    const tokenContract = await this.getTokenContract(tokenAddress, isTokenStandard);

    const balance = await tokenContract.methods.balance_of_public(ownerAddress).simulate({
      from: ownerAddress,
    });

    logger.debug(`✅ Public balance: ${balance}`);
    return balance;
  }
}

import {
  AztecAddress,
  type Wallet,
} from '@aztec/aztec.js';
import { TokenContract } from '../../../artifacts/artifacts/Token.js';
import { logger } from '@aztec/foundation/log';

export interface ITokenService {
  getPrivateBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress): Promise<bigint>;
  getPublicBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress): Promise<bigint>;
}

/**
 * Service for handling Aztec Token operations
 * Uses a Wallet instance (EmbeddedAztecWallet via BaseWallet)
 */
export class AztecTokenService implements ITokenService {
  constructor(
    private wallet: Wallet
  ) {}

  /**
   * Get private balance for a token
   */
  async getPrivateBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress): Promise<bigint> {
    logger.info(`Fetching private balance for ${tokenAddress.toString()}, owner: ${ownerAddress.toString()}`);

    const tokenContract = await TokenContract.at(
      tokenAddress,
      this.wallet
    );

    const balance = await tokenContract.methods.balance_of_private(ownerAddress).simulate({
      from: ownerAddress,
    });

    logger.info(`Private balance: ${balance}`);
    return balance;
  }

  /**
   * Get public balance for a token
   */
  async getPublicBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress): Promise<bigint> {
    logger.info(`Fetching public balance for ${tokenAddress.toString()}, owner: ${ownerAddress.toString()}`);

    const tokenContract = await TokenContract.at(
      tokenAddress,
      this.wallet
    );

    const balance = await tokenContract.methods.balance_of_public(ownerAddress).simulate({
      from: ownerAddress,
    });

    logger.info(`Public balance: ${balance}`);
    return balance;
  }
}

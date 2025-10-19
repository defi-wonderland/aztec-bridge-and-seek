import {
  ContractFunctionInteraction,
  AztecAddress,
  type Wallet,
} from '@aztec/aztec.js';
import { TokenContract } from '../../../artifacts/artifacts/Token.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
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
    logger.info(`balance of private ${tokenAddress}, ${ownerAddress}`)
    console.log(`balance of private ${(await this.wallet.getAccounts())[0].item?.toString()}`)
    const tokenContract = await TokenContract.at(
      tokenAddress,
      this.wallet
    );

    const interaction = tokenContract.methods.balance_of_private(
      ownerAddress,
    );
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Get public balance for a token
   */
  async getPublicBalance(tokenAddress: AztecAddress, ownerAddress: AztecAddress): Promise<bigint> {
    const tokenContract = await TokenContract.at(
      tokenAddress,
      this.wallet
    );

    const interaction = tokenContract.methods.balance_of_public(
      ownerAddress,
    );
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Simulate a transaction
   */
  private async simulateTransaction(interaction: ContractFunctionInteraction): Promise<any> {
    const res = await interaction.simulate({
      from: (await this.wallet.getAccounts()).at(0)?.item!,
    });
    return res;
  }
}

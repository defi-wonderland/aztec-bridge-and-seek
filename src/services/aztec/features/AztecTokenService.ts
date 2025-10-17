import {
  ContractFunctionInteraction,
  AztecAddress,
} from '@aztec/aztec.js';
import { TokenContract } from '../../../artifacts/artifacts/Token.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';

export interface ITokenService {
  getPrivateBalance(tokenAddress: string, ownerAddress: string): Promise<bigint>;
  getPublicBalance(tokenAddress: string, ownerAddress: string): Promise<bigint>;
}

/**
 * Service for handling Aztec Token operations
 */
export class AztecTokenService implements ITokenService {
  constructor(
    private connectedAccount: any
  ) {}

  /**
   * Get private balance for a token
   */
  async getPrivateBalance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(tokenAddress),
      this.connectedAccount
    );
    
    const interaction = tokenContract.methods.balance_of_private(
      AztecAddress.fromString(ownerAddress)
    );
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Get public balance for a token
   */
  async getPublicBalance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(tokenAddress),
      this.connectedAccount
    );
    
    const interaction = tokenContract.methods.balance_of_public(
      AztecAddress.fromString(ownerAddress)
    );
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Simulate a transaction
   */
  private async simulateTransaction(interaction: ContractFunctionInteraction): Promise<any> {
    const res = await interaction.simulate({
      from: this.connectedAccount.getAddress(),
    });
    return res;
  }
}

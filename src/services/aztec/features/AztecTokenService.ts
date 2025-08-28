import {
  ContractFunctionInteraction,
  AztecAddress,
} from '@aztec/aztec.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';

export interface ITokenService {
  getPrivateBalance(tokenAddress: string, ownerAddress: string): Promise<bigint>;
  getPublicBalance(tokenAddress: string, ownerAddress: string): Promise<bigint>;
  getWethPrivateBalance(wethAddress: string, ownerAddress: string): Promise<bigint>;
  getWethPublicBalance(wethAddress: string, ownerAddress: string): Promise<bigint>;
}

/**
 * Service for handling Aztec Token operations
 */
export class AztecTokenService implements ITokenService {
  constructor(
    private getConnectedAccount: () => any
  ) {}

  /**
   * Get private balance for a token
   */
  async getPrivateBalance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(tokenAddress),
      connectedAccount
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
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(tokenAddress),
      connectedAccount
    );
    
    const interaction = tokenContract.methods.balance_of_public(
      AztecAddress.fromString(ownerAddress)
    );
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Get WETH private balance
   */
  async getWethPrivateBalance(wethAddress: string, ownerAddress: string): Promise<bigint> {
    const connectedAccount = this.getConnectedAccount();
    
    if (!connectedAccount) {
      throw new Error('Account not available');
    }

    try {
      // TODO: Use the Aztec standard token contract. This contract uses that artifact
      const wethContract = await TokenContract.at(
        AztecAddress.fromString(wethAddress),
        connectedAccount
      );
      
      // TODO: Fix this method. THis is not correct because of the standard
      const interaction = wethContract.methods.balance_of_private(
        AztecAddress.fromString(ownerAddress)
      );
      const result = await this.simulateTransaction(interaction);
      return result;
    } catch (err) {
      console.error('Failed to get WETH private balance:', err);
      return 0n;
    }
  }

  /**
   * Get WETH public balance
   */
  async getWethPublicBalance(wethAddress: string, ownerAddress: string): Promise<bigint> {
    const connectedAccount = this.getConnectedAccount();
    
    if (!connectedAccount) {
      throw new Error('Account not available');
    }

    try {
      // TODO: Use the Aztec standard token contract. This contract uses that artifact
      const wethContract = await TokenContract.at(
        AztecAddress.fromString(wethAddress),
        connectedAccount
      );
      
      // TODO: Fix this method. THis is not correct because of the standard
      const interaction = wethContract.methods.balance_of_public(
        AztecAddress.fromString(ownerAddress)
      );
      const result = await this.simulateTransaction(interaction);
      return result;
    } catch (err) {
      console.error('Failed to get WETH public balance:', err);
      return 0n;
    }
  }

  /**
   * Simulate a transaction
   */
  private async simulateTransaction(interaction: ContractFunctionInteraction): Promise<any> {
    const res = await interaction.simulate();
    return res;
  }
}

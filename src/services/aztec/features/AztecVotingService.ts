import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  AztecAddress,
} from '@aztec/aztec.js';
import { IAztecVotingService } from '../../../types';
import { EasyPrivateVotingContract } from '../../../artifacts/EasyPrivateVoting';

/**
 * Service for handling Aztec voting operations
 */
export class AztecVotingService implements IAztecVotingService {
  constructor(
    private getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>,
    private contractAddress: string,
    private getConnectedAccount: () => any
  ) {}

  /**
   * Cast a vote for a specific candidate
   */
  async castVote(candidateId: number): Promise<void> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const votingContract = await EasyPrivateVotingContract.at(
      AztecAddress.fromString(this.contractAddress),
      connectedAccount
    );

    const interaction = votingContract.methods.cast_vote(candidateId);
    await this.sendTransaction(interaction);
  }

  /**
   * Get vote count for a specific candidate
   */
  async getVoteCount(candidateId: number): Promise<number> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const votingContract = await EasyPrivateVotingContract.at(
      AztecAddress.fromString(this.contractAddress),
      connectedAccount
    );

    const interaction = votingContract.methods.get_vote(candidateId);
    const result = await this.simulateTransaction(interaction);
    return result;
  }

  /**
   * Get vote counts for all candidates
   */
  async getAllVoteCounts(): Promise<{ [key: number]: number }> {
    const results: { [key: number]: number } = {};

    // Get vote counts for all 5 candidates
    for (let i = 1; i <= 5; i++) {
      try {
        results[i] = await this.getVoteCount(i);
      } catch (err) {
        console.error(`Failed to get vote for candidate ${i}:`, err);
        results[i] = 0;
      }
    }

    return results;
  }

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  private async sendTransaction(
    interaction: ContractFunctionInteraction
  ): Promise<void> {
    const paymentMethod = await this.getSponsoredFeePaymentMethod();
    const provenInteraction = await interaction.prove({
      fee: {
        paymentMethod,
      },
    });

    await provenInteraction.send().wait({ timeout: 120 });
  }

  /**
   * Simulate a transaction
   */
  private async simulateTransaction(
    interaction: ContractFunctionInteraction
  ): Promise<any> {
    const res = await interaction.simulate();
    return res;
  }
}

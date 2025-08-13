import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';
import { IAztecVotingService } from '../../../types';

/**
 * Service for handling Aztec voting operations
 */
export class AztecVotingService implements IAztecVotingService {
  constructor(private getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>) {}

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  async sendTransaction(interaction: ContractFunctionInteraction): Promise<void> {
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
  async simulateTransaction(interaction: ContractFunctionInteraction): Promise<any> {
    const res = await interaction.simulate();
    return res;
  }
}

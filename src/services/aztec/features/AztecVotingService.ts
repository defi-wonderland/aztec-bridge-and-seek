import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';

/**
 * Service for handling Aztec voting operations
 */
export class AztecVotingService {
  constructor(private getSponsoredPFCContract: () => Promise<any>) {}

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  async sendTransaction(interaction: ContractFunctionInteraction): Promise<void> {
    const sponsoredPFCContract = await this.getSponsoredPFCContract();
    const provenInteraction = await interaction.prove({
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(
          sponsoredPFCContract.address
        ),
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

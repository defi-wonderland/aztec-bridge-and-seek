import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  AztecAddress,
} from '@aztec/aztec.js';
import { IDripperService } from '../../../types';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/Dripper.js';
import { poseidon2HashBytes } from '@aztec/foundation/crypto';

/**
 * Service for handling Aztec Dripper operations
 */
export class AztecDripperService implements IDripperService {
  constructor(
    private sponsoredFeePaymentMethod: SponsoredFeePaymentMethod,
    private contractAddress: string,
    private connectedAccount: any
  ) {}

  /**
   * Mint tokens to private balance
   */
  async dripToPrivate(tokenAddress: string, amount: bigint): Promise<void> {
    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      this.connectedAccount
    );
    const interaction = dripperContract.methods.drip_to_private(
      AztecAddress.fromString(tokenAddress),
      amount
    );

    await this.sendTransaction(interaction);
  }

  /**
   * Mint tokens to public balance
   */
  async dripToPublic(tokenAddress: string, amount: bigint): Promise<void> {
    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      this.connectedAccount
    );
    
    const interaction = dripperContract.methods.drip_to_public(
      AztecAddress.fromString(tokenAddress),
      amount
    );
    await this.sendTransaction(interaction);
  }

  /**
   * Sync private state
   */
  async syncPrivateState(): Promise<void> {
    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      this.connectedAccount
    );
    
    const interaction = dripperContract.methods.sync_private_state();
    await this.sendTransaction(interaction);
  }

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  private async sendTransaction(interaction: ContractFunctionInteraction): Promise<void> {
    console.log('sending transaction from account:', this.connectedAccount.getAddress().toString())
    const provenInteraction = await interaction.prove({
      from: this.connectedAccount.getAddress(),
      fee: {
        paymentMethod: this.sponsoredFeePaymentMethod,
      },
    });

    // TODO: What if we store the prove interaction, can we re use it?
    // console.log('interaction proof', await poseidon2HashBytes(Buffer.from(provenInteraction.clientIvcProof.toBuffer())).toString())

    await provenInteraction.send().wait({ timeout: 900 });
  }
}

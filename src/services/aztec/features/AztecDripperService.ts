import type { ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { IDripperService } from '../../../types';
import { DripperContract } from '../../../../src/artifacts/Dripper.js';
import { poseidon2HashBytes } from '@aztec/foundation/crypto';

/**
 * Service for handling Aztec Dripper operations
 */
export class AztecDripperService implements IDripperService {
  constructor(
    private sponsoredFeePaymentMethod: SponsoredFeePaymentMethod,
    private dripperContractAddress: AztecAddress,
    private connectedWallet: Wallet,
  ) {}

  /**
   * Mint tokens to private balance
   */
  async dripToPrivate(tokenAddress: AztecAddress, amount: bigint): Promise<void> {
    const dripperContract = await DripperContract.at(
      this.dripperContractAddress,
      this.connectedWallet
    );

    const interaction = dripperContract.methods.drip_to_private(
      tokenAddress,
      amount
    );

    await this.sendTransaction(interaction);
  }

  /**
   * Mint tokens to public balance
   */
  async dripToPublic(tokenAddress: AztecAddress, amount: bigint): Promise<void> {
    const dripperContract = await DripperContract.at(
      this.dripperContractAddress,
      this.connectedWallet
    );
    
    const interaction = dripperContract.methods.drip_to_public(
      tokenAddress,
      amount
    );
    await this.sendTransaction(interaction);
  }

  /**
   * Sync private state
   */
  async syncPrivateState(): Promise<void> {
    const dripperContract = await DripperContract.at(
      this.dripperContractAddress,
      this.connectedWallet
    );
    
    const interaction = dripperContract.methods.sync_private_state();
    await this.sendTransaction(interaction);
  }

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  private async sendTransaction(interaction: ContractFunctionInteraction): Promise<void> {
    const sender = (await this.connectedWallet.getAccounts())[0].item;
    console.log('sending transaction from account:', sender.toString());

    // TODO: What if we store the prove interaction, can we re use it?
    // console.log('interaction proof', await poseidon2HashBytes(Buffer.from(provenInteraction.clientIvcProof.toBuffer())).toString())

    await interaction.send({
      from: sender,
      fee: {
        paymentMethod: this.sponsoredFeePaymentMethod,
      },
    }).wait({ timeout: 900 });
  }
}

/**
 * Aztec Bridge Service
 * Handles cross-chain bridge operations between Aztec and EVM chains
 */

import {
  type AccountWallet,
  type PXE,
  AztecAddress,
  Fr,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { 
  createPublicClient, 
  hexToBytes, 
  http, 
  padHex, 
  type Address,
  type PublicClient,
} from 'viem';
import { baseSepolia } from 'viem/chains';

import { OrderData } from '../../../utils/bridge/OrderData';
import { AztecGateway7683Contract, AztecGateway7683ContractArtifact } from '../../../artifacts/AztecGateway7683';
import l2Gateway7683Abi from '../../../abi/l2Gateway7683.json';
import {
  type AztecToEvmOrderParams,
  type OrderStatus,
  type BridgeCallbacks,
} from '../../../types';
import {
  AZTEC_GATEWAY,
  BASE_SEPOLIA_GATEWAY,
  AZTEC_WETH,
  BASE_SEPOLIA_WETH,
  PRIVATE_SENDER,
  PRIVATE_ORDER,
  PUBLIC_ORDER,
  AZTEC_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_FILL_DEADLINE_SECONDS,
  POLLING_INTERVAL_MS,
  FILLED,
} from '../../../config';

export class AztecBridgeService {
  private evmPublicClient: PublicClient;

  constructor(
    private pxe: PXE,
    private connectedAccount: AccountWallet
  ) {
    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    }) as PublicClient;
  }

  /**
   * Open an Aztec to EVM bridge order
   */
  async openAztecToEvmOrder(params: AztecToEvmOrderParams): Promise<OrderStatus> {

    const { confidential, sourceAmount, targetAmount, recipientAddress, nonce, callbacks } = params;

    try {
      // Update status
      const initialStatus: OrderStatus = {
        status: 'pending',
      };
      callbacks?.onStatusUpdate?.(initialStatus);

      // Create order data
      // TODO: After this change I was able to submit the tx.
      // const fillDeadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_FILL_DEADLINE_SECONDS);
      const fillDeadline = BigInt(2 ** 32 - 1);
      const orderData = new OrderData({
        // TODO: took this from aztec-to-evm.ts script.
        // sender: confidential ? PRIVATE_SENDER : account.getAddress().toString(),
        sender: padHex('0x00'), 
        recipient: recipientAddress,
        inputToken: AZTEC_WETH,
        outputToken: BASE_SEPOLIA_WETH,
        amountIn: sourceAmount,
        amountOut: targetAmount,
        senderNonce: nonce.toBigInt(),
        originDomain: AZTEC_SEPOLIA_CHAIN_ID,
        destinationDomain: BASE_SEPOLIA_CHAIN_ID,
        destinationSettler: BASE_SEPOLIA_GATEWAY,
        fillDeadline,
        orderType: confidential ? PRIVATE_ORDER : PUBLIC_ORDER,
        data: '0x',
      });

      const orderId = (await orderData.getOrderId()).toString();

      // Execute the appropriate transfer based on privacy mode
      // const receipt = confidential 
      //   ? await this.executePrivateTransfer(account, orderData, fillDeadline, sourceAmount, nonce)
      //   : await this.executePublicTransfer(account, orderData, fillDeadline, sourceAmount, nonce);
      const receipt = await this.executePrivateTransfer(orderData, fillDeadline, sourceAmount, nonce)

      callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());
      
      // Start monitoring for fill
      const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
      
      return {
        ...fillStatus,
        orderId,
        txHash: receipt.txHash.toString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      callbacks?.onError?.(error as Error);
      
      return {
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a private transfer through the gateway
   */
  private async executePrivateTransfer(
    orderData: OrderData,
    fillDeadline: bigint,
    sourceAmount: bigint,
    nonce: Fr
  ) {
    // Get contracts
    const gatewayContract = await this.getGatewayContract(this.connectedAccount);

    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const tokenContract = await AztecTokenContract.at(
      AztecAddress.fromString(AZTEC_WETH),
      this.connectedAccount
    );
    const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

    // Create authwit for gateway to spend tokens
    const action = tokenContract.methods.transfer_in_private(
      this.connectedAccount.getAddress(),
      gatewayAddress,
      sourceAmount,
      nonce
    );
    const request = await action.request();
    const authWit = await this.connectedAccount.createAuthWit((request as any).hash || request);
    
    // Add auth witness to account (Note: This method may vary by Aztec version)
    try {
      await (this.connectedAccount as any).addAuthWitness(authWit);
    } catch (error) {
      console.warn('AuthWitness addition failed, may not be required:', error);
    }

    const ORDER_DATA_TYPE = "0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0"

    const account = this.connectedAccount;
    const authWitness = await account.createAuthWit({
      caller: gatewayContract.address,
      action: tokenContract.methods.transfer_to_public(account.getAddress(), gatewayContract.address, sourceAmount, nonce),
    })
    const tx = await gatewayContract.methods
    .open_private({
      fill_deadline: fillDeadline,
      order_data: Array.from(hexToBytes(orderData.encode())),
      order_data_type: Array.from(hexToBytes(ORDER_DATA_TYPE)),
    })
    .with({
      authWitnesses: [
        authWitness,
      ],

    })
    // TODO: should the SFPC be available in the AztecContractService?
    .send({ fee: { paymentMethod: new SponsoredFeePaymentMethod(AztecAddress.fromString('0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f2')) } })

    console.log('open_private tx hash', (await tx.getTxHash()).toString())

    // Wait for transaction
    return await tx.wait({
      timeout: 120000
    });
  }

  /**
   * Execute a public transfer through the gateway
   */
  private async executePublicTransfer(
    orderData: OrderData,
    fillDeadline: bigint,
    sourceAmount: bigint,
    nonce: Fr
  ) {
    // Get contracts
    const gatewayContract = await this.getGatewayContract(this.connectedAccount);

    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const tokenContract = await AztecTokenContract.at(
      AztecAddress.fromString(AZTEC_WETH),
      this.connectedAccount
    );
    const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

    // Public transfer - directly transfer and open order
    await tokenContract.methods
      .transfer_in_public(this.connectedAccount.getAddress(), gatewayAddress, sourceAmount, nonce)
      .send()
      .wait();

    // TODO: lets uncomment this later :D
    // Call open on gateway
    // const openTx = await gatewayContract.methods
    //   .open(orderData.encode(), 'OrderData', fillDeadline)
    //   .send();
    
    // return await openTx.wait();
  }

  /**
   * Monitor EVM gateway for order filling with retry logic
   */
  private async monitorOrderFilling(
    orderId: string,
    callbacks?: BridgeCallbacks
  ): Promise<OrderStatus> {
    const maxAttempts = 360; // 30 minutes with 5 second intervals
    const maxRetries = 3; // Retry failed requests up to 3 times
    let attempts = 0;

    callbacks?.onStatusUpdate?.({ status: 'opened', orderId });

    while (attempts < maxAttempts) {
      let retries = 0;
      let success = false;

      // Retry logic for individual checks
      while (retries < maxRetries && !success) {
        try {
          const result = await this.evmPublicClient.readContract({
            address: BASE_SEPOLIA_GATEWAY as Address,
            abi: l2Gateway7683Abi,
            functionName: 'filledOrders',
            args: [orderId],
          }) as [string, string];

          // Check if order is filled (non-empty values)
          if (result[0] !== '0x' && result[1] !== '0x') {
            callbacks?.onOrderFilled?.(orderId, ''); // Fill tx hash would come from event logs
            callbacks?.onStatusUpdate?.({ 
              status: 'filled', 
              orderId,
              fillTxHash: result[1] 
            });
            
            return {
              status: 'filled',
              orderId,
              fillTxHash: result[1],
            };
          }

          success = true; // Successfully checked, order just not filled yet
        } catch (error) {
          retries++;
          console.warn(`Error checking order status (attempt ${retries}/${maxRetries}):`, error);
          
          if (retries < maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
      }

      if (!success) {
        // All retries failed, but continue monitoring
        console.error('All retries failed for order status check, continuing...');
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
      attempts++;

      // Update progress periodically
      if (attempts % 12 === 0) { // Every minute
        callbacks?.onStatusUpdate?.({ 
          status: 'opened', 
          orderId 
        });
      }
    }

    callbacks?.onStatusUpdate?.({ 
      status: 'failed', 
      orderId, 
      error: 'Order filling timeout after 30 minutes' 
    });

    return {
      status: 'failed',
      orderId,
      error: 'Order filling timeout after 30 minutes',
    };
  }

  /**
   * Register gateway contract with PXE and get contract instance
   */
  private async getGatewayContract(_account: AccountWallet): Promise<AztecGateway7683Contract | undefined> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    let gateway: AztecGateway7683Contract
    try {
      // Try to register the gateway contract
        gateway = await AztecGateway7683Contract.at(
          AztecAddress.fromString(AZTEC_GATEWAY),
          _account
        )
        return gateway
    } catch (error) {
      // Contract might already be registered, which is fine
      console.log('Gateway contract registration result:', error);
    }
  }


  /**
   * Get order status from Aztec gateway
   */
  async getAztecOrderStatus(orderId: string): Promise<number> {
    try {
      const gatewayContract = await this.getGatewayContract(this.connectedAccount);
      if (!gatewayContract) {
        throw new Error('Gateway contract not found');
      }
      const orderIdFr = Fr.fromString(orderId);
      
      const result = await gatewayContract.methods
        .get_order_status(orderIdFr)
        .simulate();
        
      return Number(result);
    } catch (error) {
      console.error('Error getting order status:', error);
      throw new Error(`Failed to get order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an order has been filled on EVM
   */
  async isOrderFilledOnEvm(orderId: string): Promise<boolean> {
    try {
      const result = await this.evmPublicClient.readContract({
        address: BASE_SEPOLIA_GATEWAY as Address,
        abi: l2Gateway7683Abi,
        functionName: 'filledOrders',
        args: [orderId],
      }) as [string, string];

      return result[0] !== '0x' && result[1] !== '0x';
    } catch (error) {
      console.error('Error checking EVM order status:', error);
      return false;
    }
  }

  /**
   * Resume monitoring an existing order
   */
  async resumeOrderMonitoring(
    orderId: string, 
    callbacks?: BridgeCallbacks
  ): Promise<OrderStatus> {
    console.log('Resuming monitoring for order:', orderId);
    
    // Check if already filled
    if (await this.isOrderFilledOnEvm(orderId)) {
      callbacks?.onOrderFilled?.(orderId, '');
      return { status: 'filled', orderId };
    }
    
    // Resume monitoring
    return this.monitorOrderFilling(orderId, callbacks);
  }
}
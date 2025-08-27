/**
 * Aztec Bridge Service
 * Handles cross-chain bridge operations between Aztec and EVM chains
 */

import {
  type AccountWallet,
  type PXE,
  AztecAddress,
  Fr,
  type TxReceipt,
  type AuthWitness,
} from '@aztec/aztec.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { 
  createPublicClient, 
  http, 
  type Address,
  type PublicClient,
  parseUnits,
  formatUnits,
} from 'viem';
import { baseSepolia } from 'viem/chains';

import { OrderData } from '../../../utils/bridge/OrderData';
import { AztecGateway7683ContractArtifact } from '../../../utils/bridge/artifacts/AztecGateway7683';
import l2Gateway7683Abi from '../../../utils/bridge/abi/l2Gateway7683.json';
import {
  type AztecToEvmOrderParams,
  type OrderStatus,
  type BridgeCallbacks,
} from '../../../utils/bridge/types';
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
  FILLED_PRIVATELY,
} from '../../../utils/bridge/constants';

export class AztecBridgeService {
  private pxe: PXE | null = null;
  private evmPublicClient: PublicClient;

  constructor(
    private getConnectedAccount: () => AccountWallet | null
  ) {
    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
  }

  /**
   * Set PXE client
   */
  setPXE(pxe: PXE) {
    this.pxe = pxe;
  }

  /**
   * Open an Aztec to EVM bridge order
   */
  async openAztecToEvmOrder(params: AztecToEvmOrderParams): Promise<OrderStatus> {
    const account = this.getConnectedAccount();
    if (!account) {
      throw new Error('No Aztec account connected');
    }

    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const { confidential, sourceAmount, targetAmount, recipientAddress, nonce, callbacks } = params;

    try {
      // Update status
      const initialStatus: OrderStatus = {
        status: 'pending',
      };
      callbacks?.onStatusUpdate?.(initialStatus);

      // Create order data
      const fillDeadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_FILL_DEADLINE_SECONDS);
      
      const orderData = new OrderData({
        sender: confidential ? PRIVATE_SENDER : account.getAddress().toString(),
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

      const orderId = orderData.getOrderId();

      // Register gateway contract if needed
      await this.registerGatewayContract();

      // Get token contract
      const tokenContract = await TokenContract.at(
        AztecAddress.fromString(AZTEC_WETH),
        account
      );

      // Create gateway contract instance
      const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

      if (confidential) {
        // For private transfers, create authwit for gateway to spend tokens
        const action = tokenContract.methods.transfer(gatewayAddress, sourceAmount);
        const authWit = await account.createAuthWit(action.request());
        
        // Add auth witness to account
        await account.addAuthWitness(authWit);

        // Call open_private on gateway
        const tx = await this.callGatewayOpenPrivate(
          account,
          orderData.encode(),
          fillDeadline
        );

        // Wait for transaction
        const receipt = await tx.wait();
        
        callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());
        
        // Start monitoring for fill
        const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
        
        return {
          ...fillStatus,
          orderId,
          txHash: receipt.txHash.toString(),
        };
      } else {
        // Public transfer - directly transfer and open order
        const transferTx = await tokenContract.methods
          .transfer_public(gatewayAddress, sourceAmount, nonce)
          .send()
          .wait();

        // Call open on gateway
        const openTx = await this.callGatewayOpen(
          account,
          orderData.encode(),
          fillDeadline
        );
        
        const receipt = await openTx.wait();
        
        callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());
        
        // Start monitoring for fill
        const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
        
        return {
          ...fillStatus,
          orderId,
          txHash: receipt.txHash.toString(),
        };
      }
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
   * Monitor EVM gateway for order filling
   */
  private async monitorOrderFilling(
    orderId: string,
    callbacks?: BridgeCallbacks
  ): Promise<OrderStatus> {
    const maxAttempts = 360; // 30 minutes with 5 second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = await this.evmPublicClient.readContract({
          address: BASE_SEPOLIA_GATEWAY as Address,
          abi: l2Gateway7683Abi,
          functionName: 'filledOrders',
          args: [orderId],
        });

        // Check if order is filled (non-empty values)
        if (result[0] !== '0x' && result[1] !== '0x') {
          callbacks?.onOrderFilled?.(orderId, ''); // Fill tx hash would come from event logs
          
          return {
            status: 'filled',
            orderId,
          };
        }
      } catch (error) {
        console.warn('Error checking order status:', error);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
      attempts++;
    }

    return {
      status: 'failed',
      orderId,
      error: 'Order filling timeout',
    };
  }

  /**
   * Register gateway contract with PXE
   */
  private async registerGatewayContract(): Promise<void> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    try {
      // Try to register the gateway contract
      // This will fail silently if already registered
      await this.pxe.registerContract({
        artifact: AztecGateway7683ContractArtifact,
        instance: {
          address: AztecAddress.fromString(AZTEC_GATEWAY),
          contractClassId: Fr.ZERO, // We don't have the actual class ID
          deployer: AztecAddress.ZERO,
          initializationHash: Fr.ZERO,
          portalContractAddress: '0x0000000000000000000000000000000000000000',
          publicKeysHash: Fr.ZERO,
          salt: Fr.ZERO,
          version: 1,
        },
      });
    } catch (error) {
      // Contract might already be registered, which is fine
      console.log('Gateway contract registration:', error);
    }
  }

  /**
   * Call gateway open function (public)
   */
  private async callGatewayOpen(
    account: AccountWallet,
    encodedOrderData: string,
    fillDeadline: bigint
  ): Promise<{ wait: () => Promise<TxReceipt> }> {
    // This would use the gateway contract methods
    // For now, we'll simulate the transaction
    throw new Error('Gateway open not yet implemented - needs actual contract interaction');
  }

  /**
   * Call gateway open_private function
   */
  private async callGatewayOpenPrivate(
    account: AccountWallet,
    encodedOrderData: string,
    fillDeadline: bigint
  ): Promise<{ wait: () => Promise<TxReceipt> }> {
    // This would use the gateway contract methods
    // For now, we'll simulate the transaction
    throw new Error('Gateway open_private not yet implemented - needs actual contract interaction');
  }

  /**
   * Get order status from Aztec gateway
   */
  async getAztecOrderStatus(orderId: string): Promise<number> {
    const account = this.getConnectedAccount();
    if (!account) {
      throw new Error('No Aztec account connected');
    }

    // This would query the gateway contract's get_order_status method
    throw new Error('Order status check not yet implemented');
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
      });

      return result[0] !== '0x' && result[1] !== '0x';
    } catch (error) {
      console.error('Error checking EVM order status:', error);
      return false;
    }
  }
}
/**
 * Aztec Bridge Service
 * Handles cross-chain bridge operations between Aztec and EVM chains
 */

import {
  type AccountWallet,
  type PXE,
  AztecAddress,
  Fr,
} from '@aztec/aztec.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { 
  createPublicClient, 
  http, 
  type Address,
  type PublicClient,
} from 'viem';
import { baseSepolia } from 'viem/chains';

// Helper function to convert hex string to number array
function hexToBytes(hex: string): number[] {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16));
  }
  return bytes;
}

import { OrderData } from '../../../utils/bridge/OrderData';
import { AztecGateway7683Contract } from '../../../utils/bridge/artifacts/AztecGateway7683/AztecGateway7683';
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
    }) as PublicClient;
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

      // Get gateway contract instance
      const gatewayContract = await this.getGatewayContract(account);

      // Get token contract
      const tokenContract = await AztecTokenContract.at(
        AztecAddress.fromString(AZTEC_WETH),
        account
      );

      // Create gateway contract instance
      const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

      if (confidential) {
        // For private transfers, create authwit for gateway to spend tokens
        const action = tokenContract.methods.transfer_in_private(account.getAddress(), gatewayAddress, sourceAmount, nonce);
        
        // Create auth witness - Aztec v1.1.3 style
        await account.createAuthWit({
          caller: gatewayAddress,
          action,
        });

        // Encode order data for gateway
        const encodedOrderData = orderData.encode();
        // Convert ORDER_DATA_TYPE constant to bytes32
        const orderDataTypeHash = '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0';
        
        // Convert hex strings to number arrays for Aztec
        const orderDataTypeBytes = hexToBytes(orderDataTypeHash);
        const orderDataBytes = hexToBytes(encodedOrderData);
        
        // Call open_private on gateway with proper structure
        const tx = await gatewayContract.methods
          .open_private({
            fill_deadline: fillDeadline,
            order_data_type: orderDataTypeBytes,
            order_data: orderDataBytes
          })
          .send();

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
        await tokenContract.methods
          .transfer_in_public(account.getAddress(), gatewayAddress, sourceAmount, nonce)
          .send()
          .wait();

        // Encode order data for gateway
        const encodedOrderData = orderData.encode();
        // Convert ORDER_DATA_TYPE constant to bytes32
        const orderDataTypeHash = '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0';
        
        // Convert hex strings to number arrays for Aztec
        const orderDataTypeBytes = hexToBytes(orderDataTypeHash);
        const orderDataBytes = hexToBytes(encodedOrderData);
        
        // Call open on gateway with proper structure
        const openTx = await gatewayContract.methods
          .open({
            fill_deadline: fillDeadline,
            order_data_type: orderDataTypeBytes,
            order_data: orderDataBytes
          })
          .send();
        
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
   * Get gateway contract instance
   */
  private async getGatewayContract(account: AccountWallet): Promise<AztecGateway7683Contract> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    // Get the contract instance at the deployed address
    const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);
    const gatewayContract = await AztecGateway7683Contract.at(gatewayAddress, account);
    
    return gatewayContract;
  }


  /**
   * Get order status from Aztec gateway
   */
  async getAztecOrderStatus(orderId: string): Promise<number> {
    const account = this.getConnectedAccount();
    if (!account) {
      throw new Error('No Aztec account connected');
    }

    try {
      const gatewayContract = await this.getGatewayContract(account);
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
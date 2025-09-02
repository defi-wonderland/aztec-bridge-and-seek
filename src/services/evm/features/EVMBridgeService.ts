/**
 * EVM Bridge Service
 * Handles cross-chain bridge operations from EVM chains to Aztec
 */

import {
  type Address,
  type Hash,
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Config } from 'wagmi';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';

import { OrderData } from '../../../utils/bridge/OrderData';
import l2Gateway7683Abi from '../../../abi/l2Gateway7683.json';
import {
  type EvmToAztecOrderParams,
  type OrderStatus,
  type BridgeCallbacks,
} from '../../../types';
import {
  AZTEC_GATEWAY,
  BASE_SEPOLIA_GATEWAY,
  AZTEC_WETH,
  BASE_SEPOLIA_WETH,
  AZTEC_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_FILL_DEADLINE_SECONDS,
  POLLING_INTERVAL_MS,
  PUBLIC_ORDER,
} from '../../../config';

// WETH ABI for approvals
const WETH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
]);

export class EVMBridgeService {
  private evmPublicClient;

  constructor(private wagmiConfig: Config) {
    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
  }

  /**
   * Open an EVM to Aztec bridge order
   */
  async openEvmToAztecOrder(params: EvmToAztecOrderParams): Promise<OrderStatus> {
    const { sourceAmount, targetAmount, recipientAddress, callbacks } = params;

    try {
      // Update status
      const initialStatus: OrderStatus = {
        status: 'pending',
      };
      callbacks?.onStatusUpdate?.(initialStatus);

      // Create order data
      const fillDeadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_FILL_DEADLINE_SECONDS);
      const nonce = BigInt(Math.floor(Math.random() * 1000000)); // Random nonce for EVM orders
      
      const orderData = new OrderData({
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000', // Will be set by EVM contract
        recipient: recipientAddress,
        inputToken: BASE_SEPOLIA_WETH,
        outputToken: AZTEC_WETH,
        amountIn: sourceAmount,
        amountOut: targetAmount,
        senderNonce: nonce,
        originDomain: BASE_SEPOLIA_CHAIN_ID,
        destinationDomain: AZTEC_SEPOLIA_CHAIN_ID,
        destinationSettler: AZTEC_GATEWAY,
        fillDeadline,
        orderType: PUBLIC_ORDER, // EVM to Aztec is always public
        data: '0x',
      });

      const orderId = orderData.getOrderId();

      // First approve WETH spending
      await this.approveWeth(sourceAmount);

      // Open order on EVM gateway
      const txHash = await this.openOrderOnEvm(orderData, fillDeadline);
      
      callbacks?.onOrderOpened?.(orderId, txHash);
      
      // Start monitoring for fill on Aztec
      const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
      
      return {
        ...fillStatus,
        orderId,
        txHash,
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
   * Approve WETH spending for the gateway
   */
  private async approveWeth(amount: bigint): Promise<void> {
    // Check current allowance
    const allowance = await this.evmPublicClient.readContract({
      address: BASE_SEPOLIA_WETH as Address,
      abi: WETH_ABI,
      functionName: 'allowance',
      args: ['0x0000000000000000000000000000000000000000', BASE_SEPOLIA_GATEWAY as Address], // Will be replaced by actual user address
    }) as bigint;

    if (allowance < amount) {
      // Approve WETH spending
      const hash = await writeContract(this.wagmiConfig, {
        address: BASE_SEPOLIA_WETH as Address,
        abi: WETH_ABI,
        functionName: 'approve',
        args: [BASE_SEPOLIA_GATEWAY as Address, amount],
      });

      // Wait for approval transaction
      await waitForTransactionReceipt(this.wagmiConfig, { hash });
    }
  }

  /**
   * Open order on EVM gateway
   */
  private async openOrderOnEvm(orderData: OrderData, fillDeadline: bigint): Promise<string> {
    const hash = await writeContract(this.wagmiConfig, {
      address: BASE_SEPOLIA_GATEWAY as Address,
      abi: l2Gateway7683Abi,
      functionName: 'open',
      args: [orderData.encode(), 'OrderData', fillDeadline],
    });

    // Wait for transaction confirmation
    await waitForTransactionReceipt(this.wagmiConfig, { hash });

    return hash;
  }

  /**
   * Monitor Aztec gateway for order filling
   * Note: This is a simplified version - in reality, you'd monitor Aztec events
   */
  private async monitorOrderFilling(
    orderId: string,
    callbacks?: BridgeCallbacks
  ): Promise<OrderStatus> {
    const maxAttempts = 360; // 30 minutes with 5 second intervals
    let attempts = 0;

    callbacks?.onStatusUpdate?.({ status: 'opened', orderId });

    while (attempts < maxAttempts) {
      try {
        // In a real implementation, you'd check the Aztec gateway for fill status
        // For now, we'll simulate monitoring
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        attempts++;

        // Update progress periodically
        if (attempts % 12 === 0) { // Every minute
          callbacks?.onStatusUpdate?.({ 
            status: 'opened', 
            orderId 
          });
        }

        // TODO: Implement actual Aztec gateway monitoring
        // This would involve checking if the order has been filled on the Aztec side
        
      } catch (error) {
        console.error('Error monitoring order status:', error);
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
   * Get WETH balance for an address
   */
  async getWethBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.evmPublicClient.readContract({
        address: BASE_SEPOLIA_WETH as Address,
        abi: WETH_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      return balance;
    } catch (error) {
      console.error('Error getting WETH balance:', error);
      return 0n;
    }
  }

  /**
   * Check if an order has been filled on EVM (for reference)
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
}
/**
 * EVM Bridge Service
 * Handles cross-chain bridge operations from EVM chains to Aztec
 * Updated to use @substancelabs/aztec-evm-bridge-sdk
 */

import {
  type Address,
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Config } from 'wagmi';
import { Bridge, type Order } from '@substancelabs/aztec-evm-bridge-sdk';
import { getWalletClient } from 'wagmi/actions';

import { EmbeddedAztecWallet } from '../../aztec/core';
import { padTo32Bytes, emptyData32Bytes } from '../../../utils/bridge';
import l2Gateway7683Abi from '../../../abi/l2Gateway7683.json';
import {
  type EvmToAztecOrderParams,
} from '../../../types';
import {
  BASE_SEPOLIA_GATEWAY,
  AZTEC_WETH,
  BASE_SEPOLIA_WETH,
  AZTEC_TESTNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
} from '../../../config';
import { TESTNET_CONFIG } from '../../../config/networks/testnet';
import { AztecBridgeService } from '../../aztec';

// WETH ABI for approvals
const WETH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
]);

export class EVMBridgeService {
  private evmPublicClient;
  private aztecBridgeService: AztecBridgeService;
  private aztecAccount: EmbeddedAztecWallet;
  private bridge: Bridge | null = null;

  constructor(private wagmiConfig: Config, evmAccount: any, aztecAccount: EmbeddedAztecWallet | null, aztecBridgeService: AztecBridgeService) {

    if (!aztecAccount) {
      throw new Error('Aztec account not connected');
    }

    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    this.aztecAccount = aztecAccount;
    this.aztecBridgeService = aztecBridgeService;
  }

  /**
   * Initialize the Substance SDK Bridge instance
   * This is called lazily to ensure we have all required credentials
   */
  private async initBridge() {
    if (this.bridge) {
      return this.bridge;
    }

    try {
      // Get EVM wallet client from wagmi
      const walletClient = await getWalletClient(this.wagmiConfig);

      // Get Aztec credentials from storage
      const secretKey = this.aztecAccount.getSecretKey();
      const salt = this.aztecAccount.getSalt();

      if (!secretKey || !salt) {
        throw new Error('Aztec account credentials not found. Please ensure your Aztec wallet is properly initialized.');
      }

      // Initialize SDK Bridge with configuration
      this.bridge = new Bridge({
        evmProvider: walletClient,
        aztecSecretKey: secretKey as any,
        aztecKeySalt: salt as any,
        aztecNodeUrl: TESTNET_CONFIG.nodeUrl,
        aztecPxeStoreDirectory: './store/pxe',
      });

      return this.bridge;
    } catch (error) {
      console.error('Failed to initialize Bridge SDK:', error);
      throw new Error('Failed to initialize Bridge SDK. Please ensure your wallets are connected.');
    }
  }

  /**
   * Open an EVM to Aztec bridge order using Substance SDK
   */
  async openEvmToAztecOrder(params: EvmToAztecOrderParams) {
    const { senderAddress, sourceAmount, targetAmount, recipientAddress, callbacks } = params;

    // Initialize the SDK Bridge
    const bridge = await this.initBridge();

    // Create the order using SDK Order interface
    const order: Order = {
      chainIdIn: BASE_SEPOLIA_CHAIN_ID,
      chainIdOut: AZTEC_TESTNET_CHAIN_ID,
      amountIn: sourceAmount,
      amountOut: targetAmount,
      tokenIn: padTo32Bytes(BASE_SEPOLIA_WETH),
      tokenOut: padTo32Bytes(AZTEC_WETH),
      recipient: padTo32Bytes(recipientAddress),
      mode: 'private',
      data: emptyData32Bytes(),
      fillDeadline: 2 ** 32 - 1, // Max deadline
    };

    console.log('Opening order with SDK...', order);

    try {
      // Open order using SDK with callbacks
      const result = await bridge.openOrder(order, {
        onSecret: ({ orderId, secret }) => {
          console.log('Secret generated:', { orderId, secret });
        },
        onOrderOpened: ({ orderId, transactionHash, resolvedOrder }) => {
          console.log('Order opened:', { orderId, transactionHash });
          callbacks?.onOrderOpened?.(orderId, transactionHash);
          callbacks?.onStatusUpdate?.({
            status: 'opened',
            orderId,
            txHash: transactionHash
          });
        },
        onOrderFilled: ({ orderId, transactionHash }) => {
          console.log('Order filled:', { orderId, transactionHash });
          callbacks?.onOrderFilled?.(orderId, transactionHash || '');
          callbacks?.onStatusUpdate?.({
            status: 'filled',
            orderId
          });
        },
        onOrderClaimed: ({ orderId, transactionHash }) => {
          console.log('Order claimed:', { orderId, transactionHash });
          callbacks?.onOrderClaimed?.(orderId, transactionHash);
          callbacks?.onStatusUpdate?.({
            status: 'filled',
            orderId,
            txHash: transactionHash
          });
        },
      });

      console.log('Bridge order completed:', result);

      // Return result in the format expected by the hook
      return {
        orderOpenedTxHash: result.orderOpenedTxHash,
        orderClaimedTxHash: result.orderClaimedTxHash || '',
      };
    } catch (error) {
      console.error('Failed to open bridge order:', error);
      throw error;
    }
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
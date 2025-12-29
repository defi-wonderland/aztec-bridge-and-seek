/**
 * EVM Bridge Service
 * Handles cross-chain bridge operations from EVM chains to Aztec
 */

import {
  type Address,
  createPublicClient,
  hexToBytes,
  padHex,
  http,
  parseAbi,
  parseAbiItem,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Config } from 'wagmi';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';

import { EmbeddedAztecWallet, AztecStorageService } from '../../aztec/core';
import { OrderData } from '../../../utils/bridge/OrderData';
import l2Gateway7683Abi from '../../../abi/l2Gateway7683.json';
import {
  type EvmToAztecOrderParams,
  type OrderStatus,
  type BridgeCallbacks,
  type PendingClaimRecord,
} from '../../../types';
import {
  AZTEC_GATEWAY,
  BASE_SEPOLIA_GATEWAY,
  AZTEC_WETH,
  BASE_SEPOLIA_WETH,
  AZTEC_DEVNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  POLLING_INTERVAL_MS,
  PRIVATE_ORDER,
  FILLED_PRIVATELY,
} from '../../../config';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { sleep } from '@aztec/foundation/sleep';
import { AztecBridgeService } from '../../aztec';

// WETH ABI for approvals
const WETH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const ORDER_DATA_TYPE_VALUE =
  '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0';
const SPONSORED_FPC_ADDRESS = AztecAddress.fromString(
  '0x299f255076aa461e4e94a843f0275303470a6b8ebe7cb44a471c66711151e529'
);

export class EVMBridgeService {
  private evmPublicClient;
  private aztecBridgeService: AztecBridgeService;
  private aztecAccount: EmbeddedAztecWallet;
  private sponsoredFeePaymentMethod: SponsoredFeePaymentMethod;
  private storageService: AztecStorageService;
  constructor(
    private wagmiConfig: Config,
    aztecAccount: EmbeddedAztecWallet | null,
    aztecBridgeService: AztecBridgeService,
    evmAccount?: any
  ) {
    if (!aztecAccount) {
      throw new Error('Aztec account not connected');
    }
    // TODO: We moved the _connect EVM account_ from the base layout to the BridgeForm component,
    // so by the time this service is instantiated, the EVM account won't be connected.
    // if (!evmAccount) {
    //   throw new Error('EVM account not connected');
    // }

    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    this.aztecAccount = aztecAccount;
    this.aztecBridgeService = aztecBridgeService;
    this.sponsoredFeePaymentMethod = new SponsoredFeePaymentMethod(
      SPONSORED_FPC_ADDRESS
    );
    this.storageService = new AztecStorageService();
  }

  /**
   * Open an EVM to Aztec bridge order
   */
  async openEvmToAztecOrder(params: EvmToAztecOrderParams) {
    const {
      senderAddress,
      sourceAmount,
      targetAmount,
      recipientAddress,
      callbacks,
    } = params;

    const gateway = await this.aztecBridgeService.getGatewayContract(
      this.aztecAccount
    );
    if (!gateway) {
      throw new Error('Gateway contract not found');
    }

    await this.approveWeth(sourceAmount);

    const fillDeadline = BigInt(2 ** 32 - 1);
    const secret = Fr.random();
    const secretHash = await poseidon2Hash([secret]);
    const nonce = Fr.random();
    const orderData = new OrderData({
      sender: padHex(senderAddress as `0x${string}`),
      recipient: secretHash.toString(),
      inputToken: padHex(BASE_SEPOLIA_WETH as `0x${string}`),
      outputToken: padHex(AZTEC_WETH as `0x${string}`),
      amountIn: sourceAmount,
      amountOut: sourceAmount,
      senderNonce: nonce.toBigInt(),
      originDomain: BASE_SEPOLIA_CHAIN_ID,
      destinationDomain: AZTEC_DEVNET_CHAIN_ID,
      destinationSettler: padHex(AZTEC_GATEWAY as `0x${string}`),
      fillDeadline,
      orderType: PRIVATE_ORDER,
      data: padHex('0x'),
    });
    const orderId = await orderData.getOrderId();
    const orderIdHex = orderId.toString();

    const persistedClaimData = {
      secret: secret.toString(),
      amountOut: sourceAmount.toString(),
      orderCreation: {
        originNetwork: baseSepolia.name,
        originGatewayAddress: BASE_SEPOLIA_GATEWAY,
        encodedOrderData: orderData.encode(),
        orderDataType: ORDER_DATA_TYPE_VALUE,
        fillDeadline: fillDeadline.toString(),
      },
    };
    // Log data for claim_private (as it should be sent) - single JSON for easy copying
    const claimPrivateLogPayload = {
      ...persistedClaimData,
      orderId: orderIdHex,
      orderIdBytes: Array.from(hexToBytes(orderIdHex)),
      note: 'originData and fillerData will come from logs when order is filled',
    };
    console.log('=== claim_private data (copy this JSON) ===');
    console.log(
      'CLAIM_PRIVATE_DATA: ',
      JSON.stringify(claimPrivateLogPayload, null, 2)
    );
    console.log('==========================================');

    let pendingClaimRecord: PendingClaimRecord | null = null;
    const persistPendingClaimRecord = () => {
      if (!pendingClaimRecord) {
        return;
      }
      try {
        this.storageService.upsertPendingClaim(pendingClaimRecord);
      } catch (storageError) {
        console.warn('Failed to persist pending claim data:', storageError);
      }
    };
    const updatePendingClaimRecord = (
      updater: (record: PendingClaimRecord) => PendingClaimRecord
    ) => {
      if (!pendingClaimRecord) {
        return;
      }
      pendingClaimRecord = updater(pendingClaimRecord);
      persistPendingClaimRecord();
    };

    const timestamp = new Date().toISOString();
    pendingClaimRecord = {
      orderId: orderIdHex,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
      claimData: persistedClaimData,
    };
    persistPendingClaimRecord();

    const orderOpenedTxHash = await this.openOrderOnEvm(
      orderData,
      fillDeadline
    );

    updatePendingClaimRecord((record) => ({
      ...record,
      sourceTxHash: orderOpenedTxHash,
      updatedAt: new Date().toISOString(),
    }));

    console.log(`order created. tx hash: ${orderOpenedTxHash}`);

    // Call onOrderOpened callback
    callbacks?.onOrderOpened?.(orderIdHex, orderOpenedTxHash);
    callbacks?.onStatusUpdate?.({
      status: 'opened',
      orderId: orderIdHex,
      txHash: orderOpenedTxHash,
    });

    // Wait for filler to fill the order
    await this.waitForOrderFilled(orderId, callbacks?.onStatusUpdate);

    // Order is now filled - update state and notify
    updatePendingClaimRecord((record) => ({
      ...record,
      status: 'ready_to_claim',
      updatedAt: new Date().toISOString(),
    }));
    callbacks?.onOrderFilled?.(orderIdHex, '');
    callbacks?.onStatusUpdate?.({ status: 'filled', orderId: orderIdHex });
    callbacks?.onStatusUpdate?.({ status: 'proving', orderId: orderIdHex });

    // Find the filled log
    const { log: filledLog } = await this.findFilledLog(orderIdHex);

    // Claim the order
    callbacks?.onStatusUpdate?.({ status: 'claiming', orderId: orderIdHex });
    await this.aztecBridgeService.claimPrivateOrder(
      orderIdHex,
      secret,
      filledLog.originData,
      filledLog.fillerData
    );

    // Clear pending claim record
    try {
      this.storageService.removePendingClaim(orderIdHex);
      pendingClaimRecord = null;
    } catch (storageError) {
      console.warn('Failed to clear pending claim data:', storageError);
    }

    // Notify completion
    callbacks?.onOrderClaimed?.(orderIdHex, '');
    callbacks?.onStatusUpdate?.({ status: 'claimed', orderId: orderIdHex });

    return {
      orderOpenedTxHash,
      orderClaimedTxHash: undefined,
    };
  }

  /**
   * Open an EVM to Aztec bridge order for bridge swap flow
   * Waits for the order to be filled, finds the log, and claims the order
   */
  async openEvmToAztecOrderForBridgeSwap(params: {
    orderId: string;
    secret: Fr | string;
    onFilledLogFound?: (txHash?: string) => void;
    onClaimed?: (txHash: string) => void;
  }) {
    const { orderId, secret, onFilledLogFound, onClaimed } = params;

    // Wait for order to be filled
    await this.waitForOrderFilled(orderId);

    // Find the filled log with txHash
    const { log: filledLog, txHash: bridgeInTxHash } = await this.findFilledLog(
      orderId,
      { includeTxHash: true }
    );

    // Notify caller that filled log was found
    onFilledLogFound?.(bridgeInTxHash);

    // Claim the order
    const result = await this.aztecBridgeService.claimPrivateOrder(
      orderId,
      secret,
      filledLog.originData,
      filledLog.fillerData
    );

    const orderClaimedTxHash = result?.txHash;

    // Notify caller that claim completed
    if (orderClaimedTxHash) {
      onClaimed?.(orderClaimedTxHash);
    }

    return { orderClaimedTxHash };
  }

  /**
   * Wait for an order to be filled on the Aztec gateway
   * Polls the gateway until status === FILLED_PRIVATELY
   */
  private async waitForOrderFilled(
    orderId: string | Fr,
    onStatusUpdate?: (status: OrderStatus) => void
  ): Promise<void> {
    const gateway = await this.aztecBridgeService.getGatewayContract(
      this.aztecAccount
    );
    if (!gateway) {
      throw new Error('Gateway contract not found');
    }

    const orderIdFr =
      typeof orderId === 'string' ? Fr.fromString(orderId) : orderId;
    const orderIdHex = orderIdFr.toString();

    while (true) {
      const status = await gateway.methods
        .get_order_status(orderIdFr)
        .simulate({
          from: this.aztecAccount.connectedAccount?.getAddress(),
          skipTxValidation: true,
        });

      if (status === BigInt(FILLED_PRIVATELY)) {
        return;
      }

      onStatusUpdate?.({ status: 'opened', orderId: orderIdHex });
      await sleep(POLLING_INTERVAL_MS);
    }
  }

  /**
   * Find the filled log for an order from Aztec gateway logs
   * Returns the parsed log and optionally the transaction hash
   */
  private async findFilledLog(
    orderId: string,
    options?: { includeTxHash?: boolean }
  ): Promise<{
    log: ReturnType<typeof parseFilledLog>;
    txHash?: string;
  }> {
    const aztecNode = this.aztecAccount.getAztecNode();
    const normalizedOrderId = orderId.toLowerCase();

    while (true) {
      try {
        await sleep(3000);

        const { logs } = await aztecNode.getPublicLogs({
          contractAddress: AztecAddress.fromString(AZTEC_GATEWAY),
        });

        // Find matching log entry
        const matchingLogEntry = logs.find((logEntry) => {
          if (!logEntry.log?.fields?.length) return false;
          try {
            const parsed = parseFilledLog(logEntry.log.fields);
            return parsed.orderId.toLowerCase() === normalizedOrderId;
          } catch {
            return false;
          }
        });

        if (!matchingLogEntry) {
          throw new Error('Filled log not found yet');
        }

        const parsedLog = parseFilledLog(matchingLogEntry.log.fields);

        // Optionally get txHash from block
        let txHash: string | undefined;
        if (options?.includeTxHash) {
          try {
            const block = await aztecNode.getBlock(
              matchingLogEntry.id.blockNumber
            );
            if (block?.body.txEffects[matchingLogEntry.id.txIndex]) {
              txHash =
                block.body.txEffects[
                  matchingLogEntry.id.txIndex
                ].txHash.toString();
            }
          } catch {
            // txHash lookup failed, continue without it
          }
        }

        return { log: parsedLog, txHash };
      } catch (err) {
        await sleep(3000);
      }
    }
  }

  async claimPrivateOrder(
    orderId: string,
    secret: Fr,
    originData: string,
    fillerData: string
  ) {
    const gateway = await this.aztecBridgeService.getGatewayContract(
      this.aztecAccount
    );
    if (!gateway) {
      throw new Error('Gateway contract not found');
    }
    // Ensure orderId has 0x prefix for hex conversion
    const orderIdHex = orderId.startsWith('0x') ? orderId : `0x${orderId}`;
    await gateway.methods
      .claim_private(
        secret,
        Array.from(hexToBytes(orderIdHex as `0x${string}`)),
        Array.from(hexToBytes(originData as `0x${string}`)),
        Array.from(hexToBytes(fillerData as `0x${string}`))
      )
      .send({
        from: this.aztecAccount.connectedAccount,
        fee: {
          paymentMethod: this.sponsoredFeePaymentMethod,
        },
      })
      .wait({
        timeout: 120000,
      });
  }

  /**
   * Approve WETH spending for the gateway
   */
  private async approveWeth(amount: bigint): Promise<void> {
    // Check current allowance
    const allowance = (await this.evmPublicClient.readContract({
      address: BASE_SEPOLIA_WETH as Address,
      abi: WETH_ABI,
      functionName: 'allowance',
      args: [
        '0x0000000000000000000000000000000000000000',
        BASE_SEPOLIA_GATEWAY as Address,
      ], // Will be replaced by actual user address
    })) as bigint;

    if (allowance < amount) {
      // Approve WETH spending
      const hash = await writeContract(this.wagmiConfig, {
        address: BASE_SEPOLIA_WETH as Address,
        abi: WETH_ABI,
        functionName: 'approve',
        args: [BASE_SEPOLIA_GATEWAY as Address, amount],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });

      // Wait for approval transaction
      await waitForTransactionReceipt(this.wagmiConfig, { hash });
    } else {
      console.log('sufficient allowance already exists');
    }
  }

  /**
   * Open order on EVM gateway
   */
  private async openOrderOnEvm(
    orderData: OrderData,
    fillDeadline: bigint
  ): Promise<string> {
    const hash = await writeContract(this.wagmiConfig, {
      address: BASE_SEPOLIA_GATEWAY as Address,
      abi: l2Gateway7683Abi,
      functionName: 'open',
      args: [
        {
          fillDeadline: Number(fillDeadline),
          orderDataType: ORDER_DATA_TYPE_VALUE,
          orderData: orderData.encode(),
        },
      ],
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
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS)
        );
        attempts++;

        // Update progress periodically
        if (attempts % 12 === 0) {
          // Every minute
          callbacks?.onStatusUpdate?.({
            status: 'opened',
            orderId,
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
      error: 'Order filling timeout after 30 minutes',
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
      const balance = (await this.evmPublicClient.readContract({
        address: BASE_SEPOLIA_WETH as Address,
        abi: WETH_ABI,
        functionName: 'balanceOf',
        args: [address],
      })) as bigint;

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
      const result = (await this.evmPublicClient.readContract({
        address: BASE_SEPOLIA_GATEWAY as Address,
        abi: l2Gateway7683Abi,
        functionName: 'filledOrders',
        args: [orderId],
      })) as [string, string];

      return result[0] !== '0x' && result[1] !== '0x';
    } catch (error) {
      console.error('Error checking EVM order status:', error);
      return false;
    }
  }

  /**
   * Fetch the swap transaction hash from Base Sepolia gateway logs.
   * The hook emits an Open event when it opens the return order after the swap.
   */
  async getSwapTxHash(hookOrderId: string): Promise<string | undefined> {
    try {
      // Get current block and search last ~500 blocks (swap just happened)
      const currentBlock = await this.evmPublicClient.getBlockNumber();
      const fromBlock = currentBlock > 500n ? currentBlock - 500n : 0n;

      // Event signature for Open
      const openEventAbi = parseAbiItem(
        'event Open(bytes32 indexed orderId, (address user, uint256 originChainId, uint32 openDeadline, uint32 fillDeadline, bytes32 orderId, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] maxSpent, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] minReceived, (uint256 destinationChainId, bytes32 destinationSettler, bytes originData)[] fillInstructions) resolvedOrder)'
      );

      const logs = await this.evmPublicClient.getLogs({
        address: BASE_SEPOLIA_GATEWAY as Address,
        event: openEventAbi,
        args: {
          orderId: hookOrderId as `0x${string}`,
        },
        fromBlock,
        toBlock: 'latest',
      });

      if (logs.length > 0) {
        return logs[0].transactionHash;
      }

      console.warn('No Open event found for hookOrderId:', hookOrderId);
      return undefined;
    } catch (error) {
      console.error('Failed to fetch swap txHash:', error);
      return undefined;
    }
  }
}

export const parseFilledLog = (log: Fr[]) => {
  let orderId = log[0].toString();
  let fillerData = log[11].toString();
  const residualBytes = log[12].toString();
  const originData =
    '0x' +
    log[1].toString().slice(4) +
    residualBytes.slice(6, 8) +
    log[2].toString().slice(4) +
    residualBytes.slice(8, 10) +
    log[3].toString().slice(4) +
    residualBytes.slice(10, 12) +
    log[4].toString().slice(4) +
    residualBytes.slice(12, 14) +
    log[5].toString().slice(4) +
    residualBytes.slice(14, 16) +
    log[6].toString().slice(4) +
    residualBytes.slice(16, 18) +
    log[7].toString().slice(4) +
    residualBytes.slice(18, 20) +
    log[8].toString().slice(4) +
    residualBytes.slice(20, 22) +
    log[9].toString().slice(4) +
    residualBytes.slice(22, 24) +
    log[10].toString().slice(4, 30);

  orderId = '0x' + orderId.slice(4) + residualBytes.slice(4, 6);
  fillerData = '0x' + fillerData.slice(4) + residualBytes.slice(24, 26);

  return {
    orderId,
    fillerData,
    originData,
  };
};

export const parseOpenLog = (log1: Fr[], log2: Fr[]) => {
  let orderId1 = log1[0].toString();
  const residualBytes1 = log1[12].toString();
  const resolvedOrder1 =
    '0x' +
    log1[1].toString().slice(4) +
    residualBytes1.slice(6, 8) +
    log1[2].toString().slice(4) +
    residualBytes1.slice(8, 10) +
    log1[3].toString().slice(4) +
    residualBytes1.slice(10, 12) +
    log1[4].toString().slice(4) +
    residualBytes1.slice(12, 14) +
    log1[5].toString().slice(4) +
    residualBytes1.slice(14, 16) +
    log1[6].toString().slice(4) +
    residualBytes1.slice(16, 18) +
    log1[7].toString().slice(4) +
    residualBytes1.slice(18, 20) +
    log1[8].toString().slice(4) +
    residualBytes1.slice(20, 22) +
    log1[9].toString().slice(4) +
    residualBytes1.slice(22, 24) +
    log1[10].toString().slice(4) +
    residualBytes1.slice(24, 26) +
    log1[11].toString().slice(4, 44);

  let orderId2 = log2[0].toString();
  const residualBytes2 = log2[10].toString();
  const resolvedOrder2 =
    log2[1].toString().slice(4) +
    residualBytes2.slice(6, 8) +
    log2[2].toString().slice(4) +
    residualBytes2.slice(8, 10) +
    log2[3].toString().slice(4) +
    residualBytes2.slice(10, 12) +
    log2[4].toString().slice(4) +
    residualBytes2.slice(12, 14) +
    log2[5].toString().slice(4) +
    residualBytes2.slice(14, 16) +
    log2[6].toString().slice(4) +
    residualBytes2.slice(16, 18) +
    log2[7].toString().slice(4) +
    residualBytes2.slice(18, 20) +
    log2[8].toString().slice(4) +
    residualBytes2.slice(20, 22) +
    log2[9].toString().slice(4, 38);

  orderId1 = '0x' + orderId1.slice(4) + residualBytes1.slice(4, 6);
  orderId2 = '0x' + orderId2.slice(4) + residualBytes2.slice(4, 6);

  if (orderId1 !== orderId2)
    throw new Error("logs don't belong to the same order");

  return {
    orderId: orderId1,
    resolvedOrder: resolvedOrder1 + resolvedOrder2,
  };
};

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
} from '../../../config';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { sleep } from '@aztec/foundation/sleep';
import { AztecBridgeService } from '../../aztec';

// WETH ABI for approvals
const WETH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const ORDER_DATA_TYPE_VALUE = "0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0"
const SPONSORED_FPC_ADDRESS = AztecAddress.fromString("0x299f255076aa461e4e94a843f0275303470a6b8ebe7cb44a471c66711151e529")

export class EVMBridgeService {
  private evmPublicClient;
  private aztecBridgeService: AztecBridgeService;
  private aztecAccount: EmbeddedAztecWallet;
  private sponsoredFeePaymentMethod: SponsoredFeePaymentMethod;
  private storageService: AztecStorageService;
  constructor(private wagmiConfig: Config, evmAccount: any, aztecAccount: EmbeddedAztecWallet | null, aztecBridgeService: AztecBridgeService) {

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
    this.sponsoredFeePaymentMethod = new SponsoredFeePaymentMethod(SPONSORED_FPC_ADDRESS);
    this.storageService = new AztecStorageService();
  }

  /**
   * Open an EVM to Aztec bridge order
   */
  async openEvmToAztecOrder(params: EvmToAztecOrderParams) {
    const { senderAddress, sourceAmount, targetAmount, recipientAddress, callbacks } = params;

    const gateway = await this.aztecBridgeService.getGatewayContract(this.aztecAccount)
    if (!gateway) {
      throw new Error('Gateway contract not found');
    }

    await this.approveWeth(sourceAmount)

    const fillDeadline = BigInt(2 ** 32 - 1)
    const secret = Fr.random()
    const secretHash = await poseidon2Hash([secret])
    const nonce = Fr.random()
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
      data: padHex("0x"),
    })
    const orderId = await orderData.getOrderId()
    const orderIdHex = orderId.toString()


    const persistedClaimData = {
      secret: secret.toString(),
      orderCreation: {
        originNetwork: baseSepolia.name,
        originGatewayAddress: BASE_SEPOLIA_GATEWAY,
        encodedOrderData: orderData.encode(),
        orderDataType: ORDER_DATA_TYPE_VALUE,
        fillDeadline: fillDeadline.toString(),
      },
    }
    // Log data for claim_private (as it should be sent) - single JSON for easy copying
    const claimPrivateLogPayload = {
      ...persistedClaimData,
      orderId: orderIdHex,
      orderIdBytes: Array.from(hexToBytes(orderIdHex)),
      note: 'originData and fillerData will come from logs when order is filled',
    }
    console.log('=== claim_private data (copy this JSON) ===')
    console.log('CLAIM_PRIVATE_DATA: ', JSON.stringify(claimPrivateLogPayload, null, 2))
    console.log('==========================================')

    let pendingClaimRecord: PendingClaimRecord | null = null
    const persistPendingClaimRecord = () => {
      if (!pendingClaimRecord) {
        return
      }
      try {
        this.storageService.upsertPendingClaim(pendingClaimRecord)
      } catch (storageError) {
        console.warn('Failed to persist pending claim data:', storageError)
      }
    }
    const updatePendingClaimRecord = (
      updater: (record: PendingClaimRecord) => PendingClaimRecord
    ) => {
      if (!pendingClaimRecord) {
        return
      }
      pendingClaimRecord = updater(pendingClaimRecord)
      persistPendingClaimRecord()
    }

    const timestamp = new Date().toISOString()
    pendingClaimRecord = {
      orderId: orderIdHex,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
      claimData: persistedClaimData,
    }
    persistPendingClaimRecord()

    const orderOpenedTxHash = await this.openOrderOnEvm(orderData, fillDeadline)

    updatePendingClaimRecord((record) => ({
      ...record,
      sourceTxHash: orderOpenedTxHash,
      updatedAt: new Date().toISOString(),
    }))

    console.log(`order created. tx hash: ${orderOpenedTxHash}`)
    
    // Call onOrderOpened callback
    callbacks?.onOrderOpened?.(orderIdHex, orderOpenedTxHash)
    callbacks?.onStatusUpdate?.({ status: 'opened', orderId: orderIdHex, txHash: orderOpenedTxHash })

    console.log("waiting for the filler to fill the order ...")

    let orderClaimedTxHash: string | undefined

    while (true) {
      console.log("getting order status ...")
      const status = await gateway.methods
        .get_order_status(orderId)
        .simulate(
          { 
            from: this.aztecAccount.connectedAccount?.getAddress(), 
            skipTxValidation: true 
          })

      console.log(`order ${orderIdHex} status: ${status}`)
      
      // FILLED_PRIVATELY = 3n
      if (status === 3n) {
        updatePendingClaimRecord((record) => ({
          ...record,
          status: 'ready_to_claim',
          updatedAt: new Date().toISOString(),
        }))
        // Call onOrderFilled callback
        callbacks?.onOrderFilled?.(orderIdHex, '')
        callbacks?.onStatusUpdate?.({ status: 'filled', orderId: orderIdHex })

        callbacks?.onStatusUpdate?.({
          status: 'proofing',
          orderId: orderIdHex,
        })

        const aztecNode = this.aztecAccount.getAztecNode()
        const normalizedOrderIdHex = orderIdHex.toLowerCase()
        let matchingLog: ReturnType<typeof parseFilledLog> | undefined
        while (true) {
          try {
            console.log(`order ${orderIdHex} filled succesfully. claiming it ...`)

            await sleep(3000)
            // TODO: understand why if i use fromBlock and toBlock i always receive the penultimante log.
            // Basically i never receive the last one even if block numbers are up to date
            const { logs } = await aztecNode.getPublicLogs({
              contractAddress: AztecAddress.fromString(AZTEC_GATEWAY),
            })

            const parsedLogs = logs
              .map(({ log: publicLog }) => {
                if (!publicLog?.fields?.length) {
                  console.warn('[EVM_BRIDGE] Skipping log without fields')
                  return null
                }
                try {
                  return parseFilledLog(publicLog.fields)
                } catch (parseError) {
                  console.warn('[EVM_BRIDGE] Failed to parse filled log entry:', parseError)
                  return null
                }
              })
              .filter(
                (entry): entry is ReturnType<typeof parseFilledLog> => entry !== null,
              )
            matchingLog = parsedLogs.find(
              ({ orderId }) => orderId.toLowerCase() === normalizedOrderIdHex,
            )
            if (!matchingLog) throw new Error('Filled log not found yet. Try again shortly.')
            break
          } catch (err) {
            console.error('[EVM_BRIDGE] Failed to fetch filled log:', err)
            await sleep(3000)
          }
        }

        if (!matchingLog) {
          throw new Error('Filled log not found; unable to claim order.')
        }

        console.log('claiming order ...')
        callbacks?.onStatusUpdate?.({
          status: 'claiming',
          orderId: orderIdHex,
        })
        await this.aztecBridgeService.claimPrivateOrder(
          orderIdHex,
          secret,
          matchingLog.originData,
          matchingLog.fillerData,
        )

        // claimPrivateOrder waits internally; reuse gateway to fetch receipt isn't needed here,
        // but we still want to surface tx hash for callbacks if available
        orderClaimedTxHash = undefined

        try {
          this.storageService.removePendingClaim(orderIdHex)
          pendingClaimRecord = null
        } catch (storageError) {
          console.warn('Failed to clear pending claim data after claim:', storageError)
        }
        
        // Call onOrderClaimed callback
        callbacks?.onOrderClaimed?.(orderIdHex, orderClaimedTxHash ?? '')
        callbacks?.onStatusUpdate?.({
          status: 'claimed',
          orderId: orderIdHex,
          txHash: orderClaimedTxHash,
        })
        
        break
      }
      console.log("waiting for 5 seconds ...")
      await sleep(5000)
    }

    // Return result matching test pattern
    return {
      orderOpenedTxHash,
      orderClaimedTxHash,
    }
  }

  async claimPrivateOrder(orderId: string, secret: Fr, originData: string, fillerData: string) {
    const gateway = await this.aztecBridgeService.getGatewayContract(this.aztecAccount)
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
        Array.from(hexToBytes(fillerData as `0x${string}`)),
      )
      .send({
        from: this.aztecAccount.connectedAccount,
        fee: {
          paymentMethod: this.sponsoredFeePaymentMethod,
        },
      })
      .wait({
        timeout: 120000,
      })
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
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });

      // Wait for approval transaction
      await waitForTransactionReceipt(this.wagmiConfig, { hash });
    } else {
      console.log("sufficient allowance already exists")
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
      args: [
        {
          fillDeadline: Number(fillDeadline),
          orderDataType: ORDER_DATA_TYPE_VALUE,
          orderData: orderData.encode(),
        }
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


export const parseFilledLog = (log: Fr[]) => {
  let orderId = log[0].toString()
  let fillerData = log[11].toString()
  const residualBytes = log[12].toString()
  const originData =
    "0x" +
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
    log[10].toString().slice(4, 30)

  orderId = "0x" + orderId.slice(4) + residualBytes.slice(4, 6)
  fillerData = "0x" + fillerData.slice(4) + residualBytes.slice(24, 26)

  return {
    orderId,
    fillerData,
    originData,
  }
}

export const parseOpenLog = (log1: Fr[], log2: Fr[]) => {
  let orderId1 = log1[0].toString()
  const residualBytes1 = log1[12].toString()
  const resolvedOrder1 =
    "0x" +
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
    log1[11].toString().slice(4, 44)

  let orderId2 = log2[0].toString()
  const residualBytes2 = log2[10].toString()
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
    log2[9].toString().slice(4, 38)

  orderId1 = "0x" + orderId1.slice(4) + residualBytes1.slice(4, 6)
  orderId2 = "0x" + orderId2.slice(4) + residualBytes2.slice(4, 6)

  if (orderId1 !== orderId2) throw new Error("logs don't belong to the same order")

  return {
    orderId: orderId1,
    resolvedOrder: resolvedOrder1 + resolvedOrder2,
  }
}
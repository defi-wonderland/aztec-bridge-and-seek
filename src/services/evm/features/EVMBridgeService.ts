/**
 * EVM Bridge Service
 * Handles cross-chain bridge operations from EVM chains to Aztec
 */

import {
  type Address,
  type Hash,
  createPublicClient,
  hexToBytes,
  padHex,
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
import { AccountWallet, AztecAddress, Fr, PXE, sleep, SponsoredFeePaymentMethod } from '@aztec/aztec.js';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { AztecGateway7683Contract, AztecGateway7683ContractArtifact } from '../../../artifacts/AztecGateway7683';
import { AztecBridgeService } from '../../aztec';

// WETH ABI for approvals
const WETH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const ORDER_DATA_TYPE_VALUE = "0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0"

export class EVMBridgeService {
  private evmPublicClient;
  private aztecBridgeService: AztecBridgeService;
  private aztecAccount: AccountWallet;
  constructor(private wagmiConfig: Config, evmAccount: any, aztecAccount: AccountWallet | null, aztecBridgeService: AztecBridgeService) {

    console.log(evmAccount, aztecAccount)

     
    // FIXME: fix me later
    // if (!aztecAccount) {
    //   throw new Error('Aztec account not connected');
    // }
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
    console.log(sourceAmount, targetAmount, recipientAddress)

    // Check current allowance first
    const allowance = await this.evmPublicClient.readContract({
      address: BASE_SEPOLIA_WETH as `0x${string}`,
      abi: WETH_ABI,
      functionName: 'allowance',
      args: [senderAddress as `0x${string}`, BASE_SEPOLIA_GATEWAY as `0x${string}`],
    }) as bigint;

    // Only approve if allowance is insufficient
    // if (allowance < sourceAmount) {
    //   console.log("approving tokens ...")
    //   const txHash = await writeContract(this.wagmiConfig, {
    //     address: BASE_SEPOLIA_WETH as `0x${string}`,
    //     abi: WETH_ABI,
    //     functionName: "approve",
    //     args: [BASE_SEPOLIA_GATEWAY as `0x${string}`, sourceAmount],
    //   })
    //   await waitForTransactionReceipt(this.wagmiConfig, { hash: txHash })
    // } else {
    //   console.log("sufficient allowance already exists")
    // }
  
    await this.approveWeth(sourceAmount)

    const fillDeadline = BigInt(2 ** 32 - 1)
    const secret = Fr.random()
    const secretHash = await poseidon2Hash([secret])
    const nonce = Fr.random()
    const orderData = new OrderData({
      sender: padHex(recipientAddress as `0x${string}`),
      recipient: secretHash.toString(),
      inputToken: padHex(BASE_SEPOLIA_WETH as `0x${string}`),
      outputToken: AZTEC_WETH as `0x${string}`,
      amountIn: sourceAmount,
      amountOut: sourceAmount,
      senderNonce: nonce.toBigInt(),
      originDomain: BASE_SEPOLIA_CHAIN_ID,
      destinationDomain: 999999,
      destinationSettler: AZTEC_GATEWAY as `0x${string}`,
      fillDeadline: fillDeadline,
      orderType: 1, // PRIVATE_ORDER
      data: padHex("0x00"),
    })
    const orderId = await orderData.getOrderId()
    console.log(`order id: ${orderId.toString()}`)
    

    console.log(`creating open order on ${baseSepolia.name} ...`)
    console.log('Gateway address:', BASE_SEPOLIA_GATEWAY)
    console.log('Encoded order data:', orderData.encode())
    console.log('ORDER_DATA_TYPE:', ORDER_DATA_TYPE_VALUE)
    console.log('Fill deadline:', fillDeadline.toString())
    
    // let txHash: string
    // try {
    //   txHash = await writeContract(this.wagmiConfig, {
    //     address: BASE_SEPOLIA_GATEWAY as `0x${string}`,
    //     functionName: "open",
    //     abi: [
    //         {
    //           "type": "function",
    //           "name": "open",
    //           "inputs": [
    //               {
    //                   "name": "_order",
    //                   "type": "tuple",
    //                   "internalType": "struct OnchainCrossChainOrder",
    //                   "components": [
    //                       {
    //                           "name": "fillDeadline",
    //                           "type": "uint32",
    //                           "internalType": "uint32"
    //                       },
    //                       {
    //                           "name": "orderDataType",
    //                           "type": "bytes32",
    //                           "internalType": "bytes32"
    //                       },
    //                       {
    //                           "name": "orderData",
    //                           "type": "bytes",
    //                           "internalType": "bytes"
    //                       }
    //                   ]
    //               }
    //           ],
    //           "outputs": [],
    //           "stateMutability": "payable"
    //       }
    //     ],
    //     args: [
    //       {
    //         fillDeadline,
    //         orderDataType: ORDER_DATA_TYPE,
    //         orderData: orderData.encode(),
    //       }
    //     ],
    //   })
    //   console.log('Transaction hash:', txHash)
    //   const receipt = await waitForTransactionReceipt(this.wagmiConfig, { hash: txHash as `0x${string}` })
    //   console.log('Transaction receipt:', receipt)
    // } catch (error) {
    //   console.error('Failed to create order:', error)
    //   throw error
    // }

    const txHash = await this.openOrderOnEvm(orderData, fillDeadline)
 
    
    console.log(`order created. tx hash: ${txHash}`)
    console.log("waiting for the filler to fill the order ...")
  
    // const pxe = await this.pxe.getPxe(rpcUrl)
    const paymentMethod = new SponsoredFeePaymentMethod(AztecAddress.fromString('0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f2'))

    while (true) {
      console.log("getting order status ...")
      console.log(orderId.toString())
      console.log(await gateway.methods.get_order_status)
      const status = await gateway!.methods.get_order_status(orderId).simulate({
        
      })
      console.log(`order ${orderId.toString()} status: ${status}`)
      // FILLED_PRIVATELY
      console.log(`status: ${status}`)
      if (status === 3n) {
        let log
        while (true) {
          try {
            console.log(`order ${orderId.toString()} filled succesfully. claiming it ...`)
  
            await sleep(3000)
            // TODO: understand why if i use fromBlock and toBlock i always receive the penultimante log.
            // Basically i never receive the last one even if block numbers are up to date
            const { logs } = await this.aztecBridgeService.pxe!.getPublicLogs({
              contractAddress: AztecAddress.fromString(AZTEC_GATEWAY),
            })
  
            const parsedLogs = logs.map(({ log }) => parseFilledLog(log.fields))
            log = parsedLogs.find((log) => log.orderId === orderId.toString())
            if (!log) throw new Error("log not found")
            break
          } catch (err) {
            console.error(err)
            sleep(3000)
          }
        }
  
        console.log("claiming order ...")
        await gateway!.methods
          .claim_private(
            secret,
            Array.from(hexToBytes(orderId.toString())),
            Array.from(hexToBytes(log.originData as `0x${string}`)),
            Array.from(hexToBytes(log.fillerData as `0x${string}`)),
          )
          .send({
            fee: {
              paymentMethod,
            },
          })
          .wait({
            timeout: 120000,
          })
        break
      }
      console.log("waiting for 15 seconds ...")
      sleep(15000)
    }

    // try {
    //   // Update status
    //   const initialStatus: OrderStatus = {
    //     status: 'pending',
    //   };
    //   callbacks?.onStatusUpdate?.(initialStatus);

    //   // Create order data
    //   const fillDeadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_FILL_DEADLINE_SECONDS);
    //   const nonce = BigInt(Math.floor(Math.random() * 1000000)); // Random nonce for EVM orders
      
    //   const orderData = new OrderData({
    //     sender: 
    //     recipient: recipientAddress,
    //     inputToken: BASE_SEPOLIA_WETH,
    //     outputToken: AZTEC_WETH,
    //     amountIn: sourceAmount,
    //     amountOut: targetAmount,
    //     senderNonce: nonce,
    //     originDomain: BASE_SEPOLIA_CHAIN_ID,
    //     destinationDomain: AZTEC_SEPOLIA_CHAIN_ID,
    //     destinationSettler: AZTEC_GATEWAY,
    //     fillDeadline,
    //     orderType: PUBLIC_ORDER, // EVM to Aztec is always public
    //     data: '0x',
    //   });

    //   const orderId = orderData.getOrderId();

    //   // First approve WETH spending
    //   await this.approveWeth(sourceAmount);

    //   // Open order on EVM gateway
    //   const txHash = await this.openOrderOnEvm(orderData, fillDeadline);
      
    //   callbacks?.onOrderOpened?.(orderId, txHash);
      
    //   // Start monitoring for fill on Aztec
    //   const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
      
    //   return {
    //     ...fillStatus,
    //     orderId,
    //     txHash,
    //   };
    // } catch (error) {
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   callbacks?.onError?.(error as Error);
      
    //   return {
    //     status: 'failed',
    //     error: errorMessage,
    //   };
    // }
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
      abi: [
            {
              "type": "function",
              "name": "open",
              "inputs": [
                  {
                      "name": "_order",
                      "type": "tuple",
                      "internalType": "struct OnchainCrossChainOrder",
                      "components": [
                          {
                              "name": "fillDeadline",
                              "type": "uint32",
                              "internalType": "uint32"
                          },
                          {
                              "name": "orderDataType",
                              "type": "bytes32",
                              "internalType": "bytes32"
                          },
                          {
                              "name": "orderData",
                              "type": "bytes",
                              "internalType": "bytes"
                          }
                      ]
                  }
              ],
              "outputs": [],
              "stateMutability": "payable"
          }
      ],
      functionName: 'open',
      args: [
        {
          fillDeadline,
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
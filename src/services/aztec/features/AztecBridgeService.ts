/**
 * Aztec Bridge Service
 * Handles cross-chain bridge operations between Aztec and EVM chains
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { Account } from '@aztec/aztec.js/account';
import { Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { TokenContract as WonderTokenContract } from '../../../artifacts/Token.js';
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
import { getAztecGatewayContractClass } from '../../../artifacts/lazyGateway.ts';
import l2Gateway7683Abi from '../../../abi/l2Gateway7683.json';
import {
  type AztecToEvmOrderParams,
  type OrderStatus,
  type BridgeCallbacks,
  AztecToEvmOrderParamsForBridgeSwap,
} from '../../../types';
import {
  AZTEC_GATEWAY,
  BASE_SEPOLIA_GATEWAY,
  AZTEC_WETH,
  BASE_SEPOLIA_WETH,
  PRIVATE_ORDER,
  PUBLIC_ORDER,
  AZTEC_DEVNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  POLLING_INTERVAL_MS,
  PRIVATE_ORDER_WITH_HOOK,
  EVM_ORDER_STATUS,
  ORDER_DATA_TYPE_HASH,
  BASE_SEPOLIA_USDC,
} from '../../../config';
import { PXE } from '@aztec/pxe/client/lazy';
import { EmbeddedAztecWallet } from '../core/EmbeddedAztecWallet';

export class AztecBridgeService {
  private evmPublicClient: PublicClient;

  constructor(
    public pxe: PXE,
    private connectedWallet: Wallet,
    private sponsoredFeePaymentMethod: SponsoredFeePaymentMethod
  ) {
    // Initialize EVM public client for Base Sepolia
    this.evmPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    }) as PublicClient;
  }

  /**
   * Get the connected account from the wallet
   * @throws Error if no account is connected
   */
  private getConnectedAccount(): Account {
    // Check if wallet is EmbeddedAztecWallet and has getConnectedAccount method
    if ('getConnectedAccount' in this.connectedWallet) {
      const account = (
        this.connectedWallet as EmbeddedAztecWallet
      ).getConnectedAccount();
      if (!account) {
        throw new Error('No account connected to wallet');
      }
      return account;
    }

    // Fallback: try to get from getAccounts (for other wallet types)
    throw new Error('Wallet does not support getConnectedAccount method');
  }

  /**
   * Get the connected account address
   */
  private async getConnectedAccountAddress(): Promise<AztecAddress> {
    const account = this.getConnectedAccount();
    return account.getAddress();
  }

  /**
   * Open an Aztec to EVM bridge order
   */
  async openAztecToEvmOrder(
    params: AztecToEvmOrderParams
  ): Promise<OrderStatus> {
    const { confidential, recipientAddress, callbacks } = params;

    return this.executeOrder({
      ...params,
      inputToken: AZTEC_WETH,
      outputToken: BASE_SEPOLIA_WETH,
      orderType: confidential ? PRIVATE_ORDER : PUBLIC_ORDER,
      data: '0x',
      tokenAddress: AZTEC_WETH,
      recipient: recipientAddress,
      callbacks,
    });
  }

  /**
   * Open an Aztec to EVM bridge order for bridge swap
   */
  async openAztecToEvmOrderForBridgeSwap(
    params: AztecToEvmOrderParamsForBridgeSwap
  ): Promise<OrderStatus> {
    const { recipientAddress, secretHash, swapTokenAddress, callbacks } =
      params;

    return this.executeOrder({
      ...params,
      inputToken: swapTokenAddress,
      outputToken: BASE_SEPOLIA_USDC,
      orderType: PRIVATE_ORDER_WITH_HOOK,
      data: padHex(secretHash.toString()),
      tokenAddress: swapTokenAddress,
      recipient: recipientAddress,
      callbacks,
    });
  }

  /**
   * Internal method to execute a bridge order
   * Consolidates common logic between regular and swap orders
   */
  private async executeOrder(config: {
    sourceAmount: bigint;
    targetAmount: bigint;
    nonce: Fr;
    inputToken: string;
    outputToken: string;
    orderType: number;
    data: string;
    tokenAddress: string;
    recipient: string;
    callbacks?: BridgeCallbacks;
  }): Promise<OrderStatus> {
    const {
      sourceAmount,
      targetAmount,
      nonce,
      inputToken,
      outputToken,
      orderType,
      data,
      tokenAddress,
      recipient,
      callbacks,
    } = config;

    try {
      callbacks?.onStatusUpdate?.({ status: 'pending' });

      const fillDeadline = BigInt(2 ** 32 - 1);

      const orderData = new OrderData({
        sender: padHex('0x00'),
        recipient,
        inputToken,
        outputToken,
        amountIn: sourceAmount,
        amountOut: targetAmount,
        senderNonce: nonce.toBigInt(),
        originDomain: AZTEC_DEVNET_CHAIN_ID,
        destinationDomain: BASE_SEPOLIA_CHAIN_ID,
        destinationSettler: BASE_SEPOLIA_GATEWAY,
        fillDeadline,
        orderType,
        data,
      });

      const orderId = (await orderData.getOrderId()).toString();

      const receipt = await this.executePrivateTransfer(
        orderData,
        fillDeadline,
        sourceAmount,
        nonce,
        tokenAddress
      );

      callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());

      const fillStatus = await this.monitorOrderFilling(orderId, callbacks);

      return {
        ...fillStatus,
        orderId,
        txHash: receipt.txHash.toString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
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
    nonce: Fr,
    tokenAddress: string = AZTEC_WETH
  ) {
    const gatewayContract = await this.getGatewayContract(this.connectedWallet);
    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const tokenContract = await WonderTokenContract.at(
      AztecAddress.fromString(tokenAddress),
      this.connectedWallet
    );

    const account = this.getConnectedAccount();
    const accountAddress = account.getAddress();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authWitness = await account.createAuthWit({
      caller: gatewayContract.address,
      action: tokenContract.methods.transfer_private_to_public(
        accountAddress,
        gatewayContract.address,
        sourceAmount,
        nonce
      ),
    } as any);

    const tx = await gatewayContract.methods
      .open_private({
        fill_deadline: fillDeadline,
        order_data: Array.from(hexToBytes(orderData.encode())),
        order_data_type: Array.from(hexToBytes(ORDER_DATA_TYPE_HASH)),
      })
      .with({
        authWitnesses: [authWitness],
      })
      .send({
        from: accountAddress,
        fee: { paymentMethod: this.sponsoredFeePaymentMethod },
      });

    console.log('open_private tx hash', (await tx.getTxHash()).toString());

    // Wait for transaction
    return await tx.wait({
      timeout: 120000,
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
    const gatewayContract = await this.getGatewayContract(this.connectedWallet);

    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const tokenContract = await WonderTokenContract.at(
      AztecAddress.fromString(AZTEC_WETH),
      this.connectedWallet
    );
    const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

    // Public transfer - directly transfer and open order
    const accountAddress = await this.getConnectedAccountAddress();
    await tokenContract.methods
      .transfer_public_to_public(
        accountAddress,
        gatewayAddress,
        sourceAmount,
        nonce
      )
      .send({
        from: accountAddress,
      })
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
          // Check order status using orderStatus function
          const status = (await this.evmPublicClient.readContract({
            address: BASE_SEPOLIA_GATEWAY as Address,
            abi: l2Gateway7683Abi,
            functionName: 'orderStatus',
            args: [orderId as `0x${string}`],
          })) as `0x${string}`;

          console.log('=== Checking orderStatus ===');
          console.log('orderId:', orderId);
          console.log('status:', status);

          if (status === EVM_ORDER_STATUS.FILLED) {
            console.log('Order is FILLED!');
            callbacks?.onOrderFilled?.(orderId, '');
            callbacks?.onStatusUpdate?.({
              status: 'filled',
              orderId,
            });

            return {
              status: 'filled',
              orderId,
            };
          }

          if (status === EVM_ORDER_STATUS.REFUNDED) {
            console.log('Order was REFUNDED!');
            callbacks?.onError?.(new Error('Order was refunded'));
            callbacks?.onStatusUpdate?.({
              status: 'failed',
              orderId,
              error: 'Order was refunded - filler did not fill before deadline',
            });

            return {
              status: 'failed',
              orderId,
              error: 'Order was refunded',
            };
          }

          success = true; // Successfully checked, order just not filled yet
        } catch (error) {
          retries++;
          console.warn(
            `Error checking order status (attempt ${retries}/${maxRetries}):`,
            error
          );

          if (retries < maxRetries) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
          }
        }
      }

      if (!success) {
        // All retries failed, but continue monitoring
        console.error(
          'All retries failed for order status check, continuing...'
        );
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
      attempts++;

      // Update progress periodically
      if (attempts % 12 === 0) {
        // Every minute
        callbacks?.onStatusUpdate?.({
          status: 'opened',
          orderId,
        });
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
   * Register gateway contract with PXE and get contract instance
   */
  public async getGatewayContract(account: Wallet): Promise<any | undefined> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    // Load the contract class lazily
    const GatewayContract = await getAztecGatewayContractClass();
    if (!GatewayContract) {
      console.warn(
        'AztecGateway7683Contract not available - artifact may be incompatible with current Aztec version'
      );
      return undefined;
    }

    try {
      // Try to get the gateway contract
      const gateway = await GatewayContract.at(
        AztecAddress.fromString(AZTEC_GATEWAY),
        account
      );
      return gateway;
    } catch (error) {
      // Contract might already be registered, which is fine
      console.error('Gateway contract registration result:', error);
      return undefined;
    }
  }

  /**
   * Get order status from Aztec gateway
   */
  async getAztecOrderStatus(orderId: string): Promise<number> {
    try {
      const gatewayContract = await this.getGatewayContract(
        this.connectedWallet
      );
      if (!gatewayContract) {
        throw new Error('Gateway contract not found');
      }
      const orderIdFr = Fr.fromString(orderId);
      const accountAddress = await this.getConnectedAccountAddress();

      const result = await gatewayContract.methods
        .get_order_status(orderIdFr)
        .simulate({
          from: accountAddress,
        });

      return Number(result);
    } catch (error) {
      console.error('Error getting order status:', error);
      throw new Error(
        `Failed to get order status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if an order has been filled on EVM
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

  /**
   * Manually claim a private order on Aztec
   */
  public async claimPrivateOrder(
    orderId: string,
    secret: Fr | string,
    originData: string,
    fillerData: string
  ): Promise<{ txHash: string }> {
    const gateway = await this.getGatewayContract(this.connectedWallet);
    if (!gateway) {
      throw new Error('Gateway contract not found');
    }

    const account = this.getConnectedAccount();
    const normalizedOrderId = orderId.startsWith('0x')
      ? orderId
      : `0x${orderId}`;
    const normalizedOrigin = originData.startsWith('0x')
      ? originData
      : `0x${originData}`;
    const normalizedFiller = fillerData.startsWith('0x')
      ? fillerData
      : `0x${fillerData}`;
    const secretField =
      typeof secret === 'string' ? Fr.fromString(secret) : secret;

    const receipt = await gateway.methods
      .claim_private(
        secretField,
        Array.from(hexToBytes(normalizedOrderId as `0x${string}`)),
        Array.from(hexToBytes(normalizedOrigin as `0x${string}`)),
        Array.from(hexToBytes(normalizedFiller as `0x${string}`))
      )
      .send({
        from: account.getAddress(),
        fee: {
          paymentMethod: this.sponsoredFeePaymentMethod,
        },
      })
      .wait({
        timeout: 120000,
      });

    return { txHash: receipt.txHash.toString() };
  }
}

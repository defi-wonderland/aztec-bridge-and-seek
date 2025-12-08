/**
 * Aztec Bridge Service
 * Handles cross-chain bridge operations between Aztec and EVM chains
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { Account } from '@aztec/aztec.js/account';
import { Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
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
import { AztecGateway7683Contract } from '../../../artifacts/AztecGateway7683.js';
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
  AZTEC_BRIDGE_SWAP_TOKEN,
  EVM_ORDER_STATUS,
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
    const {
      confidential,
      sourceAmount,
      targetAmount,
      recipientAddress,
      nonce,
      callbacks,
    } = params;

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
        originDomain: AZTEC_DEVNET_CHAIN_ID,
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
      const receipt = await this.executePrivateTransfer(
        orderData,
        fillDeadline,
        sourceAmount,
        nonce
      );

      callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());

      // Start monitoring for fill
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
   * Open an Aztec to EVM bridge order for bridge swap
   */
  async openAztecToEvmOrderForBridgeSwap(
    params: AztecToEvmOrderParamsForBridgeSwap
  ): Promise<OrderStatus> {
    const {
      confidential,
      sourceAmount,
      targetAmount,
      recipientAddress,
      nonce,
      secretHash,
      callbacks,
    } = params;

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
        inputToken: AZTEC_BRIDGE_SWAP_TOKEN,
        outputToken: '0xAf31a5CFf95131B2E0D3fa89125342984567f399',
        amountIn: sourceAmount,
        amountOut: targetAmount,
        senderNonce: nonce.toBigInt(),
        originDomain: AZTEC_TESTNET_CHAIN_ID,
        destinationDomain: BASE_SEPOLIA_CHAIN_ID,
        destinationSettler: BASE_SEPOLIA_GATEWAY,
        fillDeadline,
        orderType: PRIVATE_ORDER_WITH_HOOK,
        data: padHex(secretHash.toString()),
      });

      console.log('orderData: ', orderData);

      const orderId = (await orderData.getOrderId()).toString();
      console.log('orderId: ', orderId);

      // Execute the appropriate transfer based on privacy mode
      // const receipt = confidential
      //   ? await this.executePrivateTransfer(account, orderData, fillDeadline, sourceAmount, nonce)
      //   : await this.executePublicTransfer(account, orderData, fillDeadline, sourceAmount, nonce);
      const receipt = await this.executePrivateTransfer(
        orderData,
        fillDeadline,
        sourceAmount,
        nonce,
        AZTEC_BRIDGE_SWAP_TOKEN
      );
      console.log('receipt: ', receipt);

      callbacks?.onOrderOpened?.(orderId, receipt.txHash.toString());
      console.log('callbacks?.onOrderOpened: ', callbacks?.onOrderOpened);

      // Start monitoring for fill
      const fillStatus = await this.monitorOrderFilling(orderId, callbacks);
      console.log('fillStatus: ', fillStatus);
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
    // Get contracts
    const gatewayContract = await this.getGatewayContract(this.connectedWallet);

    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const tokenContract = await AztecTokenContract.at(
      AztecAddress.fromString(tokenAddress),
      this.connectedWallet
    );
    if (!gatewayContract) {
      throw new Error('Gateway contract not found');
    }

    const ORDER_DATA_TYPE =
      '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0';

    const account = this.getConnectedAccount();
    const accountAddress = account.getAddress();
    const authWitness = await account.createAuthWit({
      caller: gatewayContract.address,
      action: tokenContract.methods.transfer_to_public(
        accountAddress,
        gatewayContract.address,
        sourceAmount,
        nonce
      ),
    });
    const tx = await gatewayContract.methods
      .open_private({
        fill_deadline: fillDeadline,
        order_data: Array.from(hexToBytes(orderData.encode())),
        order_data_type: Array.from(hexToBytes(ORDER_DATA_TYPE)),
      })
      .with({
        authWitnesses: [authWitness],
      })
      // TODO: should the SFPC be available in the AztecContractService?
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

    const tokenContract = await AztecTokenContract.at(
      AztecAddress.fromString(AZTEC_WETH),
      this.connectedWallet
    );
    const gatewayAddress = AztecAddress.fromString(AZTEC_GATEWAY);

    // Public transfer - directly transfer and open order
    const accountAddress = await this.getConnectedAccountAddress();
    await tokenContract.methods
      .transfer_in_public(accountAddress, gatewayAddress, sourceAmount, nonce)
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
  public async getGatewayContract(_account: Wallet): Promise<any | undefined> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    let gateway: AztecGateway7683Contract;
    try {
      // Try to register the gateway contract
      gateway = await AztecGateway7683Contract.at(
        AztecAddress.fromString(AZTEC_GATEWAY),
        _account
      );
      return gateway;
    } catch (error) {
      // Contract might already be registered, which is fine
      console.error('Gateway contract registration result:', error);
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

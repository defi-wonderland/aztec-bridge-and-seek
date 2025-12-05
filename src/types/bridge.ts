/**
 * Bridge Types
 * Type definitions for Aztec-EVM bridge operations
 */

import { type Address } from 'viem';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';

export interface OrderDataParams {
  sender: string;
  recipient: string;
  inputToken: string;
  outputToken: string;
  amountIn: bigint;
  amountOut: bigint;
  senderNonce: bigint;
  originDomain: number;
  destinationDomain: number;
  destinationSettler: string;
  fillDeadline: bigint;
  orderType: number;
  data: string;
}

export interface Order {
  chainIdIn: number;
  chainIdOut: number;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  mode: 'private' | 'public';
  recipient?: string;
  data?: string;
}

export interface FillOrderDetails {
  orderId: string;
  orderData: OrderDataParams;
}

export interface RefundOrderDetails {
  orderId: string;
  chainIdIn: number;
  chainIdOut: number;
}

export interface OrderStatus {
  status:
    | 'pending'
    | 'opened'
    | 'filled'
    | 'proofing'
    | 'claiming'
    | 'claimed'
    | 'refunded'
    | 'failed';
  orderId?: string;
  txHash?: string;
  fillTxHash?: string;
  error?: string;
}

export type PendingClaimStatus = 'open' | 'ready_to_claim' | 'claimed';

export interface PendingClaimOrderCreationData {
  originNetwork: string;
  originGatewayAddress: string;
  encodedOrderData: string;
  orderDataType: string;
  fillDeadline: string;
}

export interface ClaimPrivatePreparationData {
  secret: string;
  orderCreation: PendingClaimOrderCreationData;
}

export interface PendingClaimRecord {
  orderId: string;
  status: PendingClaimStatus;
  createdAt: string;
  updatedAt: string;
  sourceTxHash?: string;
  claimData: ClaimPrivatePreparationData;
}

export interface BridgeCallbacks {
  onOrderOpened?: (orderId: string, txHash: string) => void;
  onOrderFilled?: (orderId: string, fillTxHash: string) => void;
  onOrderClaimed?: (orderId: string, claimTxHash: string) => void;
  onStatusUpdate?: (status: OrderStatus) => void;
  onError?: (error: Error) => void;
}

export interface AztecToEvmOrderParams {
  confidential: boolean;
  sourceAmount: bigint;
  targetAmount: bigint;
  recipientAddress: Address;
  nonce: Fr;
  callbacks?: BridgeCallbacks;
}

export interface AztecToEvmOrderParamsForBridgeSwap {
  confidential: boolean;
  sourceAmount: bigint;
  targetAmount: bigint;
  recipientAddress: Address;
  nonce: Fr;
  secretHash: Fr;
  callbacks?: BridgeCallbacks;
}

export interface EvmToAztecOrderParams {
  senderAddress: string;
  sourceAmount: bigint;
  targetAmount: bigint;
  recipientAddress: string; // Aztec address as string
  callbacks?: BridgeCallbacks;
}

export type BridgeDirection = 'in' | 'out';

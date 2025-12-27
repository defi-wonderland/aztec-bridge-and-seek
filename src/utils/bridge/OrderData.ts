/**
 * OrderData Class
 * Handles encoding and decoding of bridge order data
 */

import {
  encodeAbiParameters,
  decodeAbiParameters,
  keccak256,
  encodePacked,
  pad,
  toHex,
} from 'viem';
import { type OrderDataParams } from '../../types';
import { ORDER_DATA_TYPE } from '../../config';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { Fr } from '@aztec/aztec.js/fields';

/**
 * Hook data layout (128 bytes):
 * [0-31]   secretHash   - recipient secret hash for return order
 * [32-63]  minAmountOut - minimum swap output (0 = no minimum)
 * [64-95]  outputToken  - custom EVM output token (0 = use default)
 * [96-127] reserved     - future use
 */
export interface HookDataParams {
  secretHash: string;        // bytes32 - recipient secret hash
  minAmountOut?: bigint;     // uint256 - slippage protection (default: 0)
  outputToken?: string;      // address - custom output token (default: 0x0 = use default)
}

export class OrderData {
  public sender: string;
  public recipient: string;
  public inputToken: string;
  public outputToken: string;
  public amountIn: bigint;
  public amountOut: bigint;
  public senderNonce: bigint;
  public originDomain: number;
  public destinationDomain: number;
  public destinationSettler: string;
  public fillDeadline: bigint;
  public orderType: number;
  public data: string; // 128 bytes (256 hex chars)

  constructor(params: OrderDataParams) {
    this.sender = this.padAddress(params.sender);
    this.recipient = this.padAddress(params.recipient);
    this.inputToken = this.padAddress(params.inputToken);
    this.outputToken = this.padAddress(params.outputToken);
    this.amountIn = params.amountIn;
    this.amountOut = params.amountOut;
    this.senderNonce = params.senderNonce;
    this.originDomain = params.originDomain;
    this.destinationDomain = params.destinationDomain;
    this.destinationSettler = this.padAddress(params.destinationSettler);
    this.fillDeadline = params.fillDeadline;
    this.orderType = params.orderType;
    this.data = this.padData128(params.data || '0x');
  }

  /**
   * Pad address to 32 bytes
   */
  private padAddress(address: string): string {
    if (address.startsWith('0x')) {
      // Remove 0x prefix, pad to 64 chars (32 bytes), add 0x back
      return `0x${address.slice(2).padStart(64, '0')}`;
    }
    return `0x${address.padStart(64, '0')}`;
  }

  /**
   * Pad data to 128 bytes (256 hex chars)
   */
  private padData128(data: string): string {
    const hex = data.startsWith('0x') ? data.slice(2) : data;
    // Pad end with zeros to 256 hex chars (128 bytes)
    return `0x${hex.padEnd(256, '0')}`;
  }

  /**
   * Encode order data for contract interaction
   * Total: 397 bytes (301 base + 96 extra for 128-byte data field)
   */
  encode(): `0x${string}` {
    // Split 128-byte data into 4 × 32-byte chunks
    const dataHex = this.data.slice(2); // remove 0x
    const data0 = `0x${dataHex.slice(0, 64)}` as `0x${string}`;
    const data1 = `0x${dataHex.slice(64, 128)}` as `0x${string}`;
    const data2 = `0x${dataHex.slice(128, 192)}` as `0x${string}`;
    const data3 = `0x${dataHex.slice(192, 256)}` as `0x${string}`;

    return encodePacked(
      [
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint32',
        'uint32',
        'bytes32',
        'uint32',
        'uint8',
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
      ],
      [
        this.sender as `0x${string}`,
        this.recipient as `0x${string}`,
        this.inputToken as `0x${string}`,
        this.outputToken as `0x${string}`,
        this.amountIn,
        this.amountOut,
        this.senderNonce,
        this.originDomain,
        this.destinationDomain,
        this.destinationSettler as `0x${string}`,
        this.fillDeadline,
        this.orderType,
        data0,
        data1,
        data2,
        data3,
      ]
    );
  }

  // /**
  //  * Get order ID (hash of encoded data)
  //  */
  // getOrderId(): string {
  //   return keccak256(this.encode());
  // }

  async getOrderId() {
    // Split 128-byte data into 4 × 32-byte chunks for hashing (16 total inputs)
    const dataHex = this.data.slice(2);
    return await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(this.sender.slice(2), 'hex')),
      Fr.fromBufferReduce(Buffer.from(this.recipient.slice(2), 'hex')),
      Fr.fromBufferReduce(Buffer.from(this.inputToken.slice(2), 'hex')),
      Fr.fromBufferReduce(Buffer.from(this.outputToken.slice(2), 'hex')),
      Fr.fromString(this.amountIn.toString()),
      Fr.fromString(this.amountOut.toString()),
      Fr.fromString(this.senderNonce.toString()),
      new Fr(this.originDomain),
      new Fr(this.destinationDomain),
      Fr.fromBufferReduce(Buffer.from(this.destinationSettler.slice(2), 'hex')),
      new Fr(this.fillDeadline),
      new Fr(this.orderType),
      Fr.fromBufferReduce(Buffer.from(dataHex.slice(0, 64), 'hex')),
      Fr.fromBufferReduce(Buffer.from(dataHex.slice(64, 128), 'hex')),
      Fr.fromBufferReduce(Buffer.from(dataHex.slice(128, 192), 'hex')),
      Fr.fromBufferReduce(Buffer.from(dataHex.slice(192, 256), 'hex')),
    ]);
  }

  /**
   * Convert to plain object
   */
  toObject(): OrderDataParams {
    return {
      sender: this.sender,
      recipient: this.recipient,
      inputToken: this.inputToken,
      outputToken: this.outputToken,
      amountIn: this.amountIn,
      amountOut: this.amountOut,
      senderNonce: this.senderNonce,
      originDomain: this.originDomain,
      destinationDomain: this.destinationDomain,
      destinationSettler: this.destinationSettler,
      fillDeadline: this.fillDeadline,
      orderType: this.orderType,
      data: this.data,
    };
  }

  /**
   * Encode hook data for SwapHook contract
   * Layout: secretHash (32) | minAmountOut (32) | outputToken (32) | reserved (32)
   * @returns 128-byte hex string (0x + 256 hex chars)
   */
  static encodeHookData(params: HookDataParams): `0x${string}` {
    const secretHash = params.secretHash.startsWith('0x')
      ? params.secretHash.slice(2).padStart(64, '0')
      : params.secretHash.padStart(64, '0');

    const minAmountOut = (params.minAmountOut ?? 0n).toString(16).padStart(64, '0');

    const outputToken = params.outputToken
      ? (params.outputToken.startsWith('0x')
          ? params.outputToken.slice(2).padStart(64, '0')
          : params.outputToken.padStart(64, '0'))
      : '0'.repeat(64);

    const reserved = '0'.repeat(64);

    return `0x${secretHash}${minAmountOut}${outputToken}${reserved}`;
  }

  /**
   * Decode hook data from 128-byte hex string
   */
  static decodeHookData(data: string): HookDataParams {
    const hex = data.startsWith('0x') ? data.slice(2) : data;
    return {
      secretHash: `0x${hex.slice(0, 64)}`,
      minAmountOut: BigInt(`0x${hex.slice(64, 128)}`),
      outputToken: `0x${hex.slice(128, 192)}`,
    };
  }
}

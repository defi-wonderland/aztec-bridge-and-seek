/**
 * OrderData Class
 * Handles encoding and decoding of bridge order data
 */

import { encodeAbiParameters, decodeAbiParameters, keccak256, encodePacked } from 'viem';
import { type OrderDataParams } from '../../types';
import { ORDER_DATA_TYPE } from '../../config';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { Fr } from '@aztec/aztec.js/fields';

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
  public data: string;

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
    this.data = this.padAddress(params.data || '0x');
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
   * Encode order data for contract interaction
   */
  encode(): `0x${string}` {
    return encodePacked(
      [
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint32",
        "uint32",
        "bytes32",
        "uint32",
        "uint8",
        "bytes32",
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
        this.data as `0x${string}`,
      ],
    )
  }

  // /**
  //  * Get order ID (hash of encoded data)
  //  */
  // getOrderId(): string {
  //   return keccak256(this.encode());
  // }

  async getOrderId() {
    return await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(this.sender.slice(2), "hex")),
      Fr.fromBufferReduce(Buffer.from(this.recipient.slice(2), "hex")),
      Fr.fromBufferReduce(Buffer.from(this.inputToken.slice(2), "hex")),
      Fr.fromBufferReduce(Buffer.from(this.outputToken.slice(2), "hex")),
      Fr.fromString(this.amountIn.toString()),
      Fr.fromString(this.amountOut.toString()),
      Fr.fromString(this.senderNonce.toString()),
      new Fr(this.originDomain),
      new Fr(this.destinationDomain),
      Fr.fromBufferReduce(Buffer.from(this.destinationSettler.slice(2), "hex")),
      new Fr(this.fillDeadline),
      new Fr(this.orderType),
      Fr.fromBufferReduce(Buffer.from(this.data.slice(2), "hex")),
    ])
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
   * Decode packed order data back into structured format
   * Layout (in bytes):
   *   0-32:   sender (bytes32)
   *   32-64:  recipient (bytes32)
   *   64-96:  inputToken (bytes32)
   *   96-128: outputToken (bytes32)
   *   128-160: amountIn (uint256)
   *   160-192: amountOut (uint256)
   *   192-224: senderNonce (uint256)
   *   224-228: originDomain (uint32)
   *   228-232: destinationDomain (uint32)
   *   232-264: destinationSettler (bytes32)
   *   264-268: fillDeadline (uint32)
   *   268-269: orderType (uint8)
   *   269-301: data (bytes32)
   */
  static decode(encoded: string): OrderDataParams {
    // Remove 0x prefix if present
    const hex = encoded.startsWith('0x') ? encoded.slice(2) : encoded;

    // Helper to extract hex substring and convert to appropriate type
    const getBytes32 = (offset: number): string => `0x${hex.slice(offset * 2, (offset + 32) * 2)}`;
    const getUint256 = (offset: number): bigint => BigInt(`0x${hex.slice(offset * 2, (offset + 32) * 2)}`);
    const getUint32 = (offset: number): number => parseInt(hex.slice(offset * 2, (offset + 4) * 2), 16);
    const getUint8 = (offset: number): number => parseInt(hex.slice(offset * 2, (offset + 1) * 2), 16);

    return {
      sender: getBytes32(0),
      recipient: getBytes32(32),
      inputToken: getBytes32(64),
      outputToken: getBytes32(96),
      amountIn: getUint256(128),
      amountOut: getUint256(160),
      senderNonce: getUint256(192),
      originDomain: getUint32(224),
      destinationDomain: getUint32(228),
      destinationSettler: getBytes32(232),
      fillDeadline: BigInt(getUint32(264)),
      orderType: getUint8(268),
      data: getBytes32(269),
    };
  }
}
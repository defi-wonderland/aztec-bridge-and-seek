import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { Wallet, type Aliased } from '@aztec/aztec.js/wallet';
import { FunctionAbi, type ContractArtifact } from '@aztec/stdlib/abi';
import { type ContractInstanceWithAddress } from '@aztec/stdlib/contract';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { PXE } from '@aztec/pxe/client/lazy';
import { type PendingClaimRecord } from './bridge';

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export const AccountTypes = [
  'schnorr',
  'ecdsasecp256r1',
  'ecdsasecp256k1',
] as const;
export type AccountType = (typeof AccountTypes)[number];

// ============================================================================
// STORAGE SERVICE INTERFACES
// ============================================================================

/**
 * Legacy account data format (for migration from localStorage)
 */
export interface AccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

/**
 * Enhanced account data with type and alias support
 */
export interface StoredAccountData {
  address: AztecAddress;
  type: AccountType;
  secretKey: Fr;
  salt: Fr;
  signingKey: Buffer;
  alias?: string;
}

/**
 * Legacy storage service interface (deprecated, use IAztecWalletDB)
 */
export interface IAztecStorageService {
  saveAccount(accountData: AccountData): void;
  getAccount(): AccountData | null;
  clearAccount(): void;
  saveSenders(senders: string[]): void;
  getSenders(): string[];
  addSender(sender: string): void;
  removeSender(sender: string): void;
  clearSenders(): void;
  getPendingClaims(): PendingClaimRecord[];
  upsertPendingClaim(claim: PendingClaimRecord): void;
  removePendingClaim(orderId: string): void;
  clearPendingClaims(): void;
}

/**
 * Enhanced wallet database interface using IndexedDB
 */
export interface IAztecWalletDB {
  // Account operations
  storeAccount(
    address: AztecAddress,
    data: {
      type: AccountType;
      secretKey: Fr;
      salt: Fr;
      signingKey: Buffer;
      alias?: string;
    }
  ): Promise<void>;
  retrieveAccount(addressOrAlias: AztecAddress | string): Promise<{
    address: AztecAddress;
    secretKey: Fr;
    salt: Fr;
    type: AccountType;
    signingKey: Buffer;
  }>;
  listAccounts(): Promise<Aliased<AztecAddress>[]>;
  deleteAccount(address: AztecAddress): Promise<void>;

  // Metadata operations
  storeAccountMetadata(
    addressOrAlias: AztecAddress | string,
    metadataKey: string,
    metadata: Buffer
  ): Promise<void>;
  retrieveAccountMetadata(
    addressOrAlias: AztecAddress | string,
    metadataKey: string
  ): Promise<Buffer>;

  // Sender operations
  storeSender(address: AztecAddress, alias: string): Promise<void>;
  listSenders(): Promise<Aliased<AztecAddress>[]>;
  getSenders(): Promise<string[]>;
  addSender(address: string, alias?: string): Promise<void>;
  removeSender(aliasOrAddress: string): Promise<void>;
  clearSenders(): Promise<void>;

  // Fee juice operations (for bridge)
  pushBridgedFeeJuice(
    recipient: AztecAddress,
    secret: Fr,
    amount: bigint,
    leafIndex: bigint
  ): Promise<void>;
  popBridgedFeeJuice(recipient: AztecAddress): Promise<{
    amount: bigint;
    secret: string;
    leafIndex: bigint;
  }>;
}

// ============================================================================
// WALLET SERVICE INTERFACES
// ============================================================================

export interface CreateAccountResult {
  account: any; // TODO: Type this properly when we know the exact type
  wallet: Wallet;
  salt: Fr;
  secretKey: Fr;
  signingKey: Buffer; // Node.js Buffer type
}

// ============================================================================
// CONTRACT SERVICE INTERFACES
// ============================================================================

export interface IAztecContractService {
  registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs?: any[],
    constructor?: FunctionAbi | string
  ): Promise<ContractInstanceWithAddress>;
}

// ============================================================================
// VOTING SERVICE INTERFACES
// ============================================================================

export interface IAztecVotingService {
  castVote(candidateId: number): Promise<void>;
  getVoteCount(candidateId: number): Promise<number>;
  getAllVoteCounts(): Promise<{ [key: number]: number }>;
}

// ============================================================================
// DRIPPER SERVICE INTERFACES
// ============================================================================

export interface IDripperService {
  dripToPrivate(tokenAddress: AztecAddress, amount: bigint): Promise<void>;
  dripToPublic(tokenAddress: AztecAddress, amount: bigint): Promise<void>;
  syncPrivateState(): Promise<void>;
}

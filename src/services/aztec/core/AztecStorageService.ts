/**
 * Service for handling Aztec wallet storage operations
 */
import { IAztecStorageService, AccountData } from '../../../types/aztec';
import { type PendingClaimRecord } from '../../../types';

export const PENDING_CLAIMS_STORAGE_KEY = 'aztec-bridge-pending-claims';

export class AztecStorageService implements IAztecStorageService {
  private static readonly STORAGE_KEY = 'aztec-account';
  private static readonly SENDERS_STORAGE_KEY = 'aztec-senders';
  private static readonly PENDING_CLAIMS_KEY = PENDING_CLAIMS_STORAGE_KEY;
  private static readonly ACCOUNT_SECRET_HASH_KEY = 'aztec-account-secret-hash';

  /**
   * Save account data to localStorage
   */
  saveAccount(accountData: AccountData): void {
    localStorage.setItem(AztecStorageService.STORAGE_KEY, JSON.stringify(accountData));
  }

  /**
   * Persist the hashed account secret to localStorage
   */
  saveAccountSecretHash(secretHash: string): void {
    localStorage.setItem(
      AztecStorageService.ACCOUNT_SECRET_HASH_KEY,
      secretHash
    );
  }

  /**
   * Retrieve the hashed account secret from localStorage
   */
  getAccountSecretHash(): string | null {
    const secretHash = localStorage.getItem(
      AztecStorageService.ACCOUNT_SECRET_HASH_KEY
    );
    return secretHash ?? null;
  }

  /**
   * Remove the stored hashed account secret
   */
  clearAccountSecretHash(): void {
    localStorage.removeItem(AztecStorageService.ACCOUNT_SECRET_HASH_KEY);
  }

  /**
   * Get account data from localStorage
   */
  getAccount(): AccountData | null {
    const data = localStorage.getItem(AztecStorageService.STORAGE_KEY);

    if(!data) {
      return null;
    }

    const accountData = JSON.parse(data) as AccountData;


    return accountData;
  }

  /**
   * Clear account data from localStorage
   */
  clearAccount(): void {
    localStorage.removeItem(AztecStorageService.STORAGE_KEY);
  }

  /**
   * Save senders array to localStorage
   */
  saveSenders(senders: string[]): void {
    localStorage.setItem(AztecStorageService.SENDERS_STORAGE_KEY, JSON.stringify(senders));
  }

  /**
   * Get senders array from localStorage
   */
  getSenders(): string[] {
    const data = localStorage.getItem(AztecStorageService.SENDERS_STORAGE_KEY);
    if (!data) {
      return [];
    }
    try {
      return JSON.parse(data) as string[];
    } catch (error) {
      console.warn('Failed to parse saved senders:', error);
      return [];
    }
  }

  /**
   * Add a new sender to the stored list
   */
  addSender(sender: string): void {
    const existingSenders = this.getSenders();
    if (!existingSenders.includes(sender)) {
      existingSenders.push(sender);
      this.saveSenders(existingSenders);
    }
  }

  /**
   * Remove a sender from the stored list
   */
  removeSender(sender: string): void {
    const existingSenders = this.getSenders();
    const filteredSenders = existingSenders.filter(s => s !== sender);
    this.saveSenders(filteredSenders);
  }

  /**
   * Clear all saved senders from localStorage
   */
  clearSenders(): void {
    localStorage.removeItem(AztecStorageService.SENDERS_STORAGE_KEY);
  }

  /**
   * Get pending claim payloads from localStorage
   */
  getPendingClaims(): PendingClaimRecord[] {
    const data = localStorage.getItem(AztecStorageService.PENDING_CLAIMS_KEY);
    if (!data) {
      return [];
    }
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.warn('Pending claims payload is not an array, clearing storage.');
        this.clearPendingClaims();
        return [];
      }
      return parsed as PendingClaimRecord[];
    } catch (error) {
      console.warn('Failed to parse pending claims:', error);
      this.clearPendingClaims();
      return [];
    }
  }

  /**
   * Upsert (add/update) a pending claim payload
   */
  upsertPendingClaim(claim: PendingClaimRecord): void {
    const pendingClaims = this.getPendingClaims();
    const claimIndex = pendingClaims.findIndex(({ orderId }) => orderId === claim.orderId);
    if (claimIndex === -1) {
      pendingClaims.push(claim);
    } else {
      pendingClaims[claimIndex] = claim;
    }
    this.savePendingClaims(pendingClaims);
  }

  /**
   * Remove a pending claim payload by orderId
   */
  removePendingClaim(orderId: string): void {
    const updatedClaims = this.getPendingClaims().filter((claim) => claim.orderId !== orderId);
    this.savePendingClaims(updatedClaims);
  }

  /**
   * Clear all pending claim payloads
   */
  clearPendingClaims(): void {
    localStorage.removeItem(AztecStorageService.PENDING_CLAIMS_KEY);
  }

  private savePendingClaims(claims: PendingClaimRecord[]): void {
    localStorage.setItem(AztecStorageService.PENDING_CLAIMS_KEY, JSON.stringify(claims));
  }
}

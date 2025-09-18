/**
 * Service for handling Aztec wallet storage operations
 */
import { Fr } from '@aztec/aztec.js';
import { IAztecStorageService, AccountData } from '../../../types/aztec';
import { encryptData, decryptData } from '../../../utils/crypto';

export class AztecStorageService implements IAztecStorageService {
  private static readonly STORAGE_KEY = 'aztec-account';
  private static readonly SENDERS_STORAGE_KEY = 'aztec-senders';

  /**
   * Save encrypted account data to localStorage
   */
  async saveAccount(accountData: AccountData, password: string): Promise<void> {
    const dataString = JSON.stringify(accountData);
    const encryptedData = await encryptData(dataString, password);
    localStorage.setItem(AztecStorageService.STORAGE_KEY, encryptedData);
  }

  /**
   * Get and decrypt account data from localStorage
   */
  async getAccount(password: string): Promise<AccountData | null> {
    const encryptedData = localStorage.getItem(AztecStorageService.STORAGE_KEY);

    if (!encryptedData) {
      return null;
    }

    const decryptedData = await decryptData(encryptedData, password);
    
    if (!decryptedData) {
      throw new Error('Invalid password - failed to decrypt account data');
    }

    try {
      return JSON.parse(decryptedData) as AccountData;
    } catch (error) {
      throw new Error('Corrupted account data');
    }
  }

  /**
   * Check if there's stored account data (without decrypting)
   */
  hasStoredAccount(): boolean {
    return localStorage.getItem(AztecStorageService.STORAGE_KEY) !== null;
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
}

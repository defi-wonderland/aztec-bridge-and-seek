/**
 * Service for handling Aztec wallet storage operations
 */
export class AztecStorageService {
  private static readonly STORAGE_KEY = 'aztec-account';

  /**
   * Save account data to localStorage
   */
  saveAccount(accountData: {
    address: string;
    signingKey: string;
    secretKey: string;
    salt: string;
  }): void {
    localStorage.setItem(AztecStorageService.STORAGE_KEY, JSON.stringify(accountData));
  }

  /**
   * Get account data from localStorage
   */
  getAccount(): {
    address: string;
    signingKey: string;
    secretKey: string;
    salt: string;
  } | null {
    const data = localStorage.getItem(AztecStorageService.STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear account data from localStorage
   */
  clearAccount(): void {
    localStorage.removeItem(AztecStorageService.STORAGE_KEY);
  }
}

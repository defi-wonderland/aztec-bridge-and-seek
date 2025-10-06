import { AztecAddress } from '@aztec/aztec.js';
import { PXE } from '@aztec/pxe/client/lazy';
// import { PXE } from '@aztec/pxe/server';
import { AztecStorageService } from '../core/AztecStorageService';

/**
 * Service for managing sender registration and operations
 * Handles both PXE registration and local storage persistence
 */
export class AztecSendersService {
  constructor(
    private pxe: PXE,
    private storageService: AztecStorageService
  ) {}

  /**
   * Get all registered senders from PXE and sync with storage
   * Returns the most up-to-date list from PXE if available
   */
  async getRegisteredSenders(): Promise<string[]> {
    try {
      const pxeSenders = await this.pxe.getSenders();
      const senderStrings = pxeSenders.map(addr => addr.toString());
      
      // Sync with local storage
      this.storageService.saveSenders(senderStrings);
      return senderStrings;
    } catch (error) {
      console.warn('Failed to get senders from PXE, falling back to storage:', error);
      return this.storageService.getSenders();
    }
  }

  /**
   * Register a new sender address
   * Validates address format and prevents duplicates
   */
  async registerSender(addressString: string): Promise<void> {
    const trimmedAddress = addressString.trim();
    if (!trimmedAddress) {
      throw new Error('Address cannot be empty');
    }

    // Validate address format
    let aztecAddress: AztecAddress;
    try {
      aztecAddress = AztecAddress.fromString(trimmedAddress);
    } catch (error) {
      throw new Error('Invalid address format');
    }

    const normalizedAddress = aztecAddress.toString();

    // Check for duplicates
    const existingSenders = await this.getRegisteredSenders();
    if (existingSenders.includes(normalizedAddress)) {
      throw new Error('This address is already registered');
    }

    // Register with PXE
    await this.pxe.registerSender(aztecAddress);

    // Save to storage
    this.storageService.addSender(normalizedAddress);
  }

  /**
   * Remove a sender address
   */
  async removeSender(addressString: string): Promise<void> {
    const aztecAddress = AztecAddress.fromString(addressString);

    // Remove from PXE
    await this.pxe.removeSender(aztecAddress);

    // Remove from storage
    this.storageService.removeSender(addressString);
  }

  /**
   * Register multiple senders at once (used during initialization)
   * Continues on individual failures to avoid blocking initialization
   */
  async registerSavedSenders(): Promise<void> {
    try {
      const savedSenders = this.storageService.getSenders();
      
      if (savedSenders.length === 0) {
        console.log('No saved senders to register');
        return;
      }
      
      console.log(`Registering ${savedSenders.length} saved senders with PXE...`);
      
      for (const senderAddressString of savedSenders) {
        try {
          const senderAddress = AztecAddress.fromString(senderAddressString);
          await this.pxe.registerSender(senderAddress);
          console.log(`✅ Registered sender: ${senderAddressString}`);
        } catch (error) {
          // Sender might already be registered, which is fine
          console.warn(`⚠️ Failed to register sender ${senderAddressString}:`, error);
        }
      }
      
      console.log('✅ Finished registering saved senders');
    } catch (error) {
      console.error('❌ Error registering saved senders:', error);
      // Don't throw - this shouldn't block initialization
    }
  }

  /**
   * Check if a sender is registered
   */
  async isSenderRegistered(addressString: string): Promise<boolean> {
    const registeredSenders = await this.getRegisteredSenders();
    const normalizedAddress = AztecAddress.fromString(addressString).toString();
    return registeredSenders.includes(normalizedAddress);
  }

  /**
   * Clear all registered senders
   */
  async clearAllSenders(): Promise<void> {
    const senders = await this.getRegisteredSenders();
    
    // Remove from PXE
    for (const senderString of senders) {
      try {
        const senderAddress = AztecAddress.fromString(senderString);
        await this.pxe.removeSender(senderAddress);
      } catch (error) {
        console.warn(`Failed to remove sender ${senderString} from PXE:`, error);
      }
    }

    // Clear storage
    this.storageService.clearSenders();
  }

  /**
   * Get the count of registered senders
   */
  async getSenderCount(): Promise<number> {
    const senders = await this.getRegisteredSenders();
    return senders.length;
  }
}

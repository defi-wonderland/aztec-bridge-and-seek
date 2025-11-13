import { AztecAddress } from '@aztec/aztec.js/addresses';
import { PXE } from '@aztec/pxe/client/lazy';
import { AztecStorageService } from '../core/AztecStorageService';

/**
 * Interface for senders service operations
 */
export interface ISendersService {
  getRegisteredSenders(): Promise<string[]>;
  registerSender(address: string): Promise<void>;
  removeSender(address: string): Promise<void>;
}

/**
 * Service for managing registered senders
 * Registers senders with PXE for note discovery and persists them in storage
 */
export class AztecSendersService implements ISendersService {
  constructor(
    private storageService: AztecStorageService,
    private pxe: PXE
  ) {}

  /**
   * Get all registered senders
   */
  async getRegisteredSenders(): Promise<string[]> {
    return this.storageService.getSenders();
  }

  /**
   * Register a new sender address
   * Registers with PXE for note discovery and saves to storage
   */
  async registerSender(address: string): Promise<void> {
    // Convert string address to AztecAddress
    const senderAddress = AztecAddress.fromString(address);
    
    // Register with PXE for note discovery
    await this.pxe.registerSender(senderAddress);
    
    // Save to storage for persistence
    this.storageService.addSender(address);
  }

  /**
   * Remove a sender address
   * Removes from both PXE storage (for note discovery) and localStorage (for persistence)
   */
  async removeSender(address: string): Promise<void> {
    // Convert string address to AztecAddress
    const senderAddress = AztecAddress.fromString(address);
    
    // Remove from PXE storage (IndexedDB)
    await this.pxe.removeSender(senderAddress);
    
    // Remove from localStorage
    this.storageService.removeSender(address);
  }

  /**
   * Sync senders between localStorage and PXE storage
   * - Registers all senders from localStorage with PXE
   * - Removes any senders from PXE that aren't in localStorage
   * Call this during initialization to ensure both storages are in sync
   */
  async registerStoredSenders(): Promise<void> {
    const storedSenders = this.storageService.getSenders();
    const storedSenderSet = new Set(storedSenders);
    
    // Get all senders currently registered in PXE
    const pxeSenders = await this.pxe.getSenders();
    
    // Remove any senders from PXE that aren't in localStorage
    for (const pxeSender of pxeSenders) {
      const pxeSenderString = pxeSender.toString();
      if (!storedSenderSet.has(pxeSenderString)) {
        try {
          await this.pxe.removeSender(pxeSender);
        } catch (error) {
          console.warn(`Failed to remove sender ${pxeSenderString} from PXE:`, error);
        }
      }
    }
    
    // Register all senders from localStorage with PXE
    for (const sender of storedSenders) {
      try {
        const senderAddress = AztecAddress.fromString(sender);
        await this.pxe.registerSender(senderAddress);
      } catch (error) {
        console.warn(`Failed to register stored sender ${sender}:`, error);
      }
    }
  }
}

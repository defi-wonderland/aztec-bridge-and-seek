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
   * Note: PXE doesn't have an explicit remove method, but removing from storage
   * prevents re-registration on next initialization
   */
  async removeSender(address: string): Promise<void> {
    this.storageService.removeSender(address);
  }

  /**
   * Register all senders from storage with PXE
   * Call this during initialization to restore registered senders
   */
  async registerStoredSenders(): Promise<void> {
    const storedSenders = this.storageService.getSenders();
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

import React, { useState, useEffect } from 'react';
import { AztecAddress } from '@aztec/aztec.js';
import { useAztecWallet } from '../../hooks/context';
import { AztecStorageService } from '../../services/aztec/storage';

export const RegisterSenderTab: React.FC = () => {
  const [registeredSenders, setRegisteredSenders] = useState<string[]>([]);
  const [newSenderAddress, setNewSenderAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { walletService } = useAztecWallet();
  const storageService = new AztecStorageService();

  useEffect(() => {
    loadRegisteredSenders();
  }, []);

  const loadRegisteredSenders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load from localStorage
      const savedSenders = storageService.getSenders();
      setRegisteredSenders(savedSenders);
      
      // Also sync with PXE to ensure consistency
      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        const pxeSenders = await pxe.getSenders();
        const pxeSenderStrings = pxeSenders.map(addr => addr.toString());
        
        // Merge saved senders with PXE senders (PXE is source of truth)
        setRegisteredSenders(pxeSenderStrings);
        storageService.saveSenders(pxeSenderStrings);
      }
    } catch (err) {
      setError(`Failed to load registered senders: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSender = async () => {
    if (!newSenderAddress.trim()) {
      setError('Please enter a valid address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Validate the address format
      const aztecAddress = AztecAddress.fromString(newSenderAddress.trim());
      const addressString = aztecAddress.toString();

      // Check if already registered
      if (registeredSenders.includes(addressString)) {
        setError('This address is already registered');
        return;
      }

      // Register with PXE
      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        await pxe.registerSender(aztecAddress);
      }

      // Save to localStorage
      storageService.addSender(addressString);
      
      // Update state
      setRegisteredSenders(prev => [...prev, addressString]);
      setNewSenderAddress('');
      setSuccess('Sender registered successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(`Failed to register sender: ${err instanceof Error ? err.message : 'Invalid address format'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSender = async (senderAddress: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Remove from PXE
      if (walletService?.getPXE) {
        const pxe = walletService.getPXE();
        const aztecAddress = AztecAddress.fromString(senderAddress);
        await pxe.removeSender(aztecAddress);
      }

      // Remove from localStorage
      storageService.removeSender(senderAddress);
      
      // Update state
      setRegisteredSenders(prev => prev.filter(addr => addr !== senderAddress));
      setSuccess('Sender removed successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(`Failed to remove sender: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSender();
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="register-sender-content">
      <div className="settings-section">
        <h4>Registered Senders</h4>
        <p>Register addresses that can send you tokens. This allows your PXE to decrypt notes from these senders.</p>
        
        {error && (
          <div className="error-message" onClick={clearMessages}>
            ❌ {error}
          </div>
        )}
        
        {success && (
          <div className="success-message" onClick={clearMessages}>
            ✅ {success}
          </div>
        )}

        <div className="add-sender-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter Aztec address (0x...)"
              value={newSenderAddress}
              onChange={(e) => setNewSenderAddress(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="sender-input"
            />
            <button
              onClick={handleAddSender}
              disabled={isLoading || !newSenderAddress.trim()}
              className="add-sender-btn"
            >
              {isLoading ? '...' : 'Add Sender'}
            </button>
          </div>
        </div>

        <div className="senders-list">
          {isLoading && registeredSenders.length === 0 ? (
            <div className="loading-message">Loading registered senders...</div>
          ) : registeredSenders.length === 0 ? (
            <div className="empty-state">
              <p>No senders registered yet.</p>
              <p>Add sender addresses to receive tokens from them.</p>
            </div>
          ) : (
            <div className="senders-grid">
              {registeredSenders.map((sender, index) => (
                <div key={sender} className="sender-item">
                  <div className="sender-info">
                    <div className="sender-label">Sender #{index + 1}</div>
                    <div className="sender-address">{sender}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveSender(sender)}
                    disabled={isLoading}
                    className="remove-sender-btn"
                    title="Remove sender"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sender-help">
          <p><strong>Note:</strong> Registered senders are automatically loaded when you start the application.</p>
          <p>Only add addresses you trust to send you tokens.</p>
        </div>
      </div>
    </div>
  );
};
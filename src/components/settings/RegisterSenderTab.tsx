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
    <div className="senders-content">
      <div className="form-section">
        {error && (
          <div className="error-message" onClick={clearMessages}>
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div className="success-message" onClick={clearMessages}>
            ✅ {success}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="sender-address">Add New Sender Address</label>
          <input
            id="sender-address"
            type="text"
            placeholder="Enter Aztec address (0x...)"
            value={newSenderAddress}
            onChange={(e) => setNewSenderAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="form-input"
          />
          <button
            onClick={handleAddSender}
            disabled={isLoading || !newSenderAddress.trim()}
            className="btn btn-primary add-sender-btn"
          >
            <span className="btn-icon">➕</span>
            {isLoading ? 'Adding...' : 'Add Sender'}
          </button>
          <p className="field-help">Register addresses that can send you tokens. This allows your PXE to decrypt notes from these senders.</p>
        </div>

        <div className="senders-section">
          <div className="content-header">
            <div className="icon-container">
              <span className="icon">📝</span>
            </div>
            <div>
              <h4>Registered Senders ({registeredSenders.length})</h4>
              <p>Addresses authorized to send you tokens</p>
            </div>
          </div>

          <div className="senders-list">
            {isLoading && registeredSenders.length === 0 ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading registered senders...</p>
              </div>
            ) : registeredSenders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h5>No senders registered yet</h5>
                <p>Add sender addresses to receive tokens from them.</p>
              </div>
            ) : (
              <div className="senders-grid">
                {registeredSenders.map((sender, index) => (
                  <div key={sender} className="sender-card">
                    <div className="sender-header">
                      <div className="sender-label">
                        <span className="sender-icon">👤</span>
                        Sender #{index + 1}
                      </div>
                      <button
                        onClick={() => handleRemoveSender(sender)}
                        disabled={isLoading}
                        className="btn btn-danger remove-btn"
                        title="Remove sender"
                      >
                        <span className="btn-icon">🗑️</span>
                      </button>
                    </div>
                    <div className="sender-address">
                      <span className="address-text" title={sender}>{sender}</span>
                      <button
                        className="copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(sender);
                          setSuccess('Address copied to clipboard');
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                        title="Copy address"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
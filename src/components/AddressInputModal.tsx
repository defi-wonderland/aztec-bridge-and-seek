import React, { useState, useEffect, useCallback } from 'react';
import { isValidEvmAddress } from '../utils/address';

interface AddressInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with address string for custom address, or null to use connected wallet */
  onConfirm: (address: string | null) => void;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
  /** The custom address (not the connected wallet address) */
  customAddress?: string | null;
  isWalletConnected?: boolean;
  connectedWalletAddress?: string;
}

/**
 * Modal component for entering or selecting an EVM address
 * Allows users to either paste a custom address or use their connected wallet
 *
 * - customAddress: only for pasted addresses, null means using connected wallet
 * - When "Use Connected Wallet" is clicked, onConfirm(null) is called
 * - When a custom address is confirmed, onConfirm(address) is called
 */
export const AddressInputModal: React.FC<AddressInputModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onConnectWallet,
  onDisconnectWallet,
  customAddress = null,
  isWalletConnected = false,
  connectedWalletAddress,
}) => {
  // Input only shows custom address, not connected wallet address
  const [inputValue, setInputValue] = useState(customAddress || '');
  const [error, setError] = useState<string | null>(null);

  // Check if currently using the connected wallet (no custom address set)
  const isUsingConnectedWallet =
    isWalletConnected && connectedWalletAddress && !customAddress;

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Only populate input with custom address, not connected wallet
      setInputValue(customAddress || '');
      setError(null);
    }
  }, [isOpen, customAddress]);

  // Handle click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle escape key to close (only when modal is open)
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      setError(null);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) {
      setError('Please enter an address');
      return;
    }

    if (!isValidEvmAddress(trimmedValue)) {
      setError('Invalid EVM address format');
      return;
    }

    onConfirm(trimmedValue);
    onClose();
  }, [inputValue, onConfirm, onClose]);

  const handleUseConnectedWallet = useCallback(() => {
    if (connectedWalletAddress) {
      // Pass null to indicate using connected wallet (clears custom address)
      onConfirm(null);
      onClose();
    }
  }, [connectedWalletAddress, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="address-modal-overlay" onClick={handleOverlayClick}>
      <div className="address-modal">
        <div className="address-modal-header">
          <h3 className="address-modal-title">Enter Recipient Address</h3>
          <button
            className="address-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="address-modal-content">
          <div className="address-modal-input-section">
            <label
              className="address-modal-label"
              htmlFor="recipient-address-input"
            >
              Paste EVM Address
            </label>
            <input
              id="recipient-address-input"
              type="text"
              className={`address-modal-input ${error ? 'has-error' : ''}`}
              placeholder="0x..."
              value={inputValue}
              onChange={handleInputChange}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            {error && <span className="address-modal-error">{error}</span>}
            <button
              className="address-modal-confirm-btn"
              onClick={handleConfirm}
              type="button"
            >
              Done
            </button>
          </div>

          <div className="address-modal-divider">
            <span>or</span>
          </div>

          <div className="address-modal-wallet-section">
            {isWalletConnected && connectedWalletAddress ? (
              <div className="address-modal-wallet-row">
                <button
                  className={`address-modal-wallet-btn ${isUsingConnectedWallet ? 'active' : ''}`}
                  onClick={handleUseConnectedWallet}
                  type="button"
                >
                  <span className="wallet-icon">🔗</span>
                  <span className="wallet-text">
                    {isUsingConnectedWallet && 'Using Connected Wallet'}
                    {!isUsingConnectedWallet && 'Use Connected Wallet'}
                    <span className="wallet-address">
                      {connectedWalletAddress.slice(0, 6)}...
                      {connectedWalletAddress.slice(-4)}
                    </span>
                  </span>
                </button>
                {onDisconnectWallet && (
                  <button
                    className="address-modal-disconnect-btn"
                    onClick={onDisconnectWallet}
                    type="button"
                    title="Disconnect wallet"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <button
                className="address-modal-wallet-btn"
                onClick={onConnectWallet}
                type="button"
              >
                <span className="wallet-icon">👛</span>
                <span className="wallet-text">Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

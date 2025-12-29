import React, { useState, useEffect, useCallback } from 'react';
import { isValidEvmAddress } from '../utils/address';

interface AddressInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (address: string) => void;
  onConnectWallet: () => void;
  currentAddress?: string;
  isWalletConnected?: boolean;
  connectedWalletAddress?: string;
}

/**
 * Modal component for entering or selecting an EVM address
 * Allows users to either paste a custom address or connect their wallet
 */
export const AddressInputModal: React.FC<AddressInputModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onConnectWallet,
  currentAddress = '',
  isWalletConnected = false,
  connectedWalletAddress,
}) => {
  const [inputValue, setInputValue] = useState(currentAddress);
  const [error, setError] = useState<string | null>(null);

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(currentAddress);
      setError(null);
    }
  }, [isOpen, currentAddress]);

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
      onConfirm(connectedWalletAddress);
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
              <button
                className="address-modal-wallet-btn connected"
                onClick={handleUseConnectedWallet}
                type="button"
              >
                <span className="wallet-icon">🔗</span>
                <span className="wallet-text">
                  Use Connected Wallet
                  <span className="wallet-address">
                    {connectedWalletAddress.slice(0, 6)}...
                    {connectedWalletAddress.slice(-4)}
                  </span>
                </span>
              </button>
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

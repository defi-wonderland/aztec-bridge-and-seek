import React, { useState, useEffect } from 'react';
import { WalletCreateFlow } from './WalletCreateFlow';
import { WalletConnectFlow } from './WalletConnectFlow';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected: () => void;
  hasExistingWallets: boolean;
}

type FlowState = 'initial' | 'create' | 'connect';

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onWalletConnected,
  hasExistingWallets,
}) => {
  const [flowState, setFlowState] = useState<FlowState>('initial');
  const [error, setError] = useState<string | null>(null);

  // Reset flow state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFlowState('initial');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSuccess = () => {
    onWalletConnected();
    onClose();
  };

  const handleConnectSuccess = () => {
    onWalletConnected();
    onClose();
  };

  const handleBack = () => {
    setFlowState('initial');
    setError(null);
  };

  const renderContent = () => {
    switch (flowState) {
      case 'create':
        return (
          <WalletCreateFlow
            onSuccess={handleCreateSuccess}
            onBack={handleBack}
            onError={setError}
          />
        );

      case 'connect':
        return (
          <WalletConnectFlow
            onSuccess={handleConnectSuccess}
            onBack={handleBack}
            onError={setError}
          />
        );

      case 'initial':
      default:
        return (
          <div className="wallet-modal-initial">
            <h2 className="wallet-modal-title">Connect Your Wallet</h2>
            <p className="wallet-modal-description">
              To use Aztec Bridge and Seek, you need to connect your Aztec wallet.
              Your wallet is secured with a passkey and stored safely in your device.
            </p>

            <div className="wallet-modal-buttons">
              <button
                className="wallet-modal-button wallet-modal-button-primary"
                onClick={() => setFlowState('create')}
              >
                <div className="wallet-modal-button-icon">+</div>
                <div className="wallet-modal-button-content">
                  <div className="wallet-modal-button-title">Create New Wallet</div>
                  <div className="wallet-modal-button-subtitle">
                    Generate a new Aztec wallet secured with a passkey
                  </div>
                </div>
              </button>

              {hasExistingWallets && (
                <button
                  className="wallet-modal-button wallet-modal-button-secondary"
                  onClick={() => setFlowState('connect')}
                >
                  <div className="wallet-modal-button-icon">🔑</div>
                  <div className="wallet-modal-button-content">
                    <div className="wallet-modal-button-title">
                      Connect Existing Wallet
                    </div>
                    <div className="wallet-modal-button-subtitle">
                      Use your passkey to access your wallet
                    </div>
                  </div>
                </button>
              )}
            </div>

            {error && (
              <div className="wallet-modal-error">
                <span>⚠️ {error}</span>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <div className="wallet-modal-overlay" onClick={onClose} />
      <div className="wallet-modal">
        <button className="wallet-modal-close" onClick={onClose}>
          ×
        </button>
        {renderContent()}
      </div>

      <style>{`
        .wallet-flow-spinner {
          width: 4rem;
          height: 4rem;
          border: 4px solid #e2e8f0;
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .wallet-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 999;
          animation: fadeIn 0.2s ease-out;
        }

        .wallet-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          max-width: 480px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          z-index: 1000;
          animation: slideUp 0.3s ease-out;
        }

        .wallet-modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: transparent;
          border: none;
          font-size: 1.5rem;
          color: #64748b;
          cursor: pointer;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .wallet-modal-close:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .wallet-modal-initial {
          padding: 2rem;
        }

        .wallet-modal-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.75rem 0;
          text-align: center;
        }

        .wallet-modal-description {
          color: #64748b;
          font-size: 0.875rem;
          line-height: 1.5;
          text-align: center;
          margin: 0 0 2rem 0;
        }

        .wallet-modal-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .wallet-modal-button {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        }

        .wallet-modal-button:hover {
          border-color: #8b5cf6;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .wallet-modal-button-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-color: #8b5cf6;
          color: white;
        }

        .wallet-modal-button-primary:hover {
          border-color: #7c3aed;
          box-shadow: 0 10px 15px -3px rgba(139, 92, 246, 0.3);
        }

        .wallet-modal-button-icon {
          font-size: 2rem;
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .wallet-modal-button-secondary .wallet-modal-button-icon {
          background: #f1f5f9;
        }

        .wallet-modal-button-content {
          flex: 1;
        }

        .wallet-modal-button-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .wallet-modal-button-secondary .wallet-modal-button-title {
          color: #1e293b;
        }

        .wallet-modal-button-subtitle {
          font-size: 0.75rem;
          opacity: 0.9;
        }

        .wallet-modal-button-secondary .wallet-modal-button-subtitle {
          color: #64748b;
        }

        .wallet-modal-error {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
          text-align: center;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
};

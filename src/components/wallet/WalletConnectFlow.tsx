import React, { useState } from 'react';
import { PasskeyService } from '../../services/passkey/PasskeyService';
import { useAztecWallet } from '../../hooks';

interface WalletConnectFlowProps {
  onSuccess: () => void;
  onBack: () => void;
  onError: (error: string) => void;
}

type ConnectState = 'initial' | 'connecting' | 'success' | 'error';

export const WalletConnectFlow: React.FC<WalletConnectFlowProps> = ({
  onSuccess,
  onBack,
  onError,
}) => {
  const [connectState, setConnectState] = useState<ConnectState>('initial');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const { connectAccountWithPasskey } = useAztecWallet();

  const handleConnectWallet = async () => {
    try {
      setConnectState('connecting');
      setStatusMessage('Connecting to your wallet...');
      onError('');

      // Check if passkeys are supported
      if (!PasskeyService.isPasskeySupported()) {
        throw new Error(
          'Passkeys are not supported in your browser. Please use a modern browser like Chrome, Safari, or Edge.'
        );
      }

      // Connect wallet with passkey (this will prompt the user)
      setStatusMessage(
        'Please authenticate with your passkey in your browser...'
      );
      const credentials = await PasskeyService.connectWalletWithPasskey();

      if (!credentials) {
        throw new Error('No wallet found. Please create a new wallet first.');
      }

      // Connect the account
      setStatusMessage('Loading your account...');

      await connectAccountWithPasskey(
        credentials.secretKey,
        credentials.salt,
        credentials.signingKey,
        credentials.credentialId
      );

      setConnectState('success');
      setStatusMessage('Wallet connected successfully!');

      // Wait a moment before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setConnectState('error');
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect wallet';
      setStatusMessage(errorMessage);
      onError(errorMessage);
    }
  };

  const renderContent = () => {
    switch (connectState) {
      case 'connecting':
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-spinner" />
            <h3 className="wallet-flow-title">{statusMessage}</h3>
            <p className="wallet-flow-description">
              Your browser will prompt you to authenticate with your passkey.
              Select the passkey associated with your Aztec wallet.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-success-icon">✓</div>
            <h3 className="wallet-flow-title">Wallet Connected!</h3>
            <p className="wallet-flow-description">
              Your wallet has been connected successfully.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-error-icon">⚠️</div>
            <h3 className="wallet-flow-title">Error</h3>
            <p className="wallet-flow-description">{statusMessage}</p>
            <div className="wallet-flow-buttons">
              <button
                className="wallet-flow-button wallet-flow-button-secondary"
                onClick={onBack}
              >
                Go Back
              </button>
              <button
                className="wallet-flow-button wallet-flow-button-primary"
                onClick={handleConnectWallet}
              >
                Try Again
              </button>
            </div>
          </div>
        );

      case 'initial':
      default:
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-icon">🔑</div>
            <h3 className="wallet-flow-title">Connect Existing Wallet</h3>
            <p className="wallet-flow-description">
              Use your passkey to access your existing Aztec wallet. Your browser
              will prompt you to authenticate with your passkey.
            </p>

            <div className="wallet-flow-info-box">
              <h4 className="wallet-flow-info-title">Before you continue:</h4>
              <ul className="wallet-flow-info-list">
                <li>
                  Make sure you're on the device where you created your wallet
                </li>
                <li>
                  Or ensure your passkey is synced to this device via your cloud
                  account
                </li>
                <li>Your browser will ask you to authenticate</li>
              </ul>
            </div>

            <div className="wallet-flow-buttons">
              <button
                className="wallet-flow-button wallet-flow-button-secondary"
                onClick={onBack}
              >
                Go Back
              </button>
              <button
                className="wallet-flow-button wallet-flow-button-primary"
                onClick={handleConnectWallet}
              >
                Connect Wallet
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="wallet-flow">
      {renderContent()}

      <style>{`
        .wallet-flow {
          padding: 2rem;
        }

        .wallet-flow-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .wallet-flow-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .wallet-flow-spinner {
          width: 4rem;
          height: 4rem;
          border: 4px solid #e2e8f0;
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        .wallet-flow-success-icon {
          width: 4rem;
          height: 4rem;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 1rem;
        }

        .wallet-flow-error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .wallet-flow-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.75rem 0;
        }

        .wallet-flow-description {
          color: #64748b;
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 0 0 1.5rem 0;
          max-width: 400px;
        }

        .wallet-flow-info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
          width: 100%;
          text-align: left;
        }

        .wallet-flow-info-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.75rem 0;
        }

        .wallet-flow-info-list {
          margin: 0;
          padding-left: 1.25rem;
          color: #64748b;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .wallet-flow-info-list li {
          margin-bottom: 0.25rem;
        }

        .wallet-flow-buttons {
          display: flex;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.5rem;
        }

        .wallet-flow-button {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .wallet-flow-button-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }

        .wallet-flow-button-primary:hover {
          box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.3);
          transform: translateY(-1px);
        }

        .wallet-flow-button-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .wallet-flow-button-secondary {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .wallet-flow-button-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

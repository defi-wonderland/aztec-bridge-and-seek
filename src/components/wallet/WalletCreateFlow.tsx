import React, { useState } from 'react';
import { PasskeyService } from '../../services/passkey/PasskeyService';
import { useAztecWallet } from '../../hooks';

interface WalletCreateFlowProps {
  onSuccess: () => void;
  onBack: () => void;
  onError: (error: string) => void;
}

type CreateState = 'initial' | 'creating' | 'deploying' | 'success' | 'error';

export const WalletCreateFlow: React.FC<WalletCreateFlowProps> = ({
  onSuccess,
  onBack,
  onError,
}) => {
  const [createState, setCreateState] = useState<CreateState>('initial');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const { createAccountWithPasskey } = useAztecWallet();

  const handleCreateWallet = async () => {
    try {
      setCreateState('creating');
      setStatusMessage('Creating your wallet with passkey...');
      onError('');

      // Check if passkeys are supported
      if (!PasskeyService.isPasskeySupported()) {
        throw new Error(
          'Passkeys are not supported in your browser. Please use a modern browser like Chrome, Safari, or Edge.'
        );
      }

      // Create wallet with passkey (this will prompt the user)
      setStatusMessage('Please confirm the passkey creation in your browser...');
      const credentials = await PasskeyService.createWalletWithPasskey();

      // Create and deploy the account
      setCreateState('deploying');
      setStatusMessage('Deploying your account on Aztec...');

      await createAccountWithPasskey(
        credentials.secretKey,
        credentials.salt,
        credentials.signingKey,
        credentials.credentialId
      );

      setCreateState('success');
      setStatusMessage('Wallet created successfully!');

      // Wait a moment before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error creating wallet:', error);
      setCreateState('error');
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create wallet';
      setStatusMessage(errorMessage);
      onError(errorMessage);
    }
  };

  const renderContent = () => {
    switch (createState) {
      case 'creating':
      case 'deploying':
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-spinner" />
            <h3 className="wallet-flow-title">{statusMessage}</h3>
            <p className="wallet-flow-description">
              {createState === 'creating'
                ? 'Your browser will prompt you to create a passkey. This passkey will secure your wallet.'
                : 'This may take a few moments. Please do not close this window.'}
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="wallet-flow-content">
            <div className="wallet-flow-success-icon">✓</div>
            <h3 className="wallet-flow-title">Wallet Created!</h3>
            <p className="wallet-flow-description">
              Your wallet has been created and deployed successfully.
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
                onClick={handleCreateWallet}
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
            <div className="wallet-flow-icon">🔐</div>
            <h3 className="wallet-flow-title">Create New Wallet</h3>
            <p className="wallet-flow-description">
              Your new wallet will be secured with a passkey. Passkeys are stored
              securely on your device and can be synced across your devices using
              your cloud account (iCloud, Google Password Manager, etc.).
            </p>

            <div className="wallet-flow-info-box">
              <h4 className="wallet-flow-info-title">What is a passkey?</h4>
              <ul className="wallet-flow-info-list">
                <li>A secure, password-free way to authenticate</li>
                <li>Protected by your device's security (Face ID, Touch ID, PIN)</li>
                <li>Cannot be phished or stolen</li>
                <li>Can be synced across your devices</li>
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
                onClick={handleCreateWallet}
              >
                Create Wallet
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

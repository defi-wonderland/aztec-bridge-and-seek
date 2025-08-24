import React, { useEffect, useState } from 'react';
import { useAztecWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';

export const StatusMessage: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useAztecWallet();
  const {
    errors: globalErrors,
    clearError,
    clearAllErrors,
    hasErrors,
  } = useError();
  const [walletStatusVisible, setWalletStatusVisible] = useState(true);

  const renderStatus = () => {
    if (!isInitialized) {
      return 'Initializing Aztec wallet...';
    }

    if (isLoading) {
      return 'Loading...';
    }

    if (walletError) {
      return walletError;
    }

    return null;
  };

  const statusText = renderStatus();
  const hasWalletError = walletError && isInitialized;
  const shouldShow = statusText && isInitialized && walletStatusVisible;

  // Auto-hide wallet status messages after timeout
  useEffect(() => {
    if (statusText && isInitialized) {
      setWalletStatusVisible(true);

      // Set timeout based on message type
      const timeout = hasWalletError ? 8000 : 4000; // 8s for errors, 4s for info
      const timeoutId = setTimeout(() => {
        setWalletStatusVisible(false);
      }, timeout);

      return () => clearTimeout(timeoutId);
    }
  }, [statusText, isInitialized, hasWalletError]);

  // Reset visibility when status changes
  useEffect(() => {
    if (statusText) {
      setWalletStatusVisible(true);
    }
  }, [statusText]);

  // Don't render if no status to show and no global errors
  if (!shouldShow && !hasErrors) {
    return null;
  }

  return (
    <div className="status-messages-container">
      {/* Wallet/Provider Status */}
      {shouldShow && (
        <div
          id="status-message"
          className={`status-message ${hasWalletError ? 'error' : 'info'}`}
        >
          {statusText}
          <button
            className={`error-close ${hasWalletError ? '' : 'info-close'}`}
            onClick={() => setWalletStatusVisible(false)}
            title="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Global Errors */}
      {globalErrors.map((error) => (
        <div
          key={error.id}
          className={`status-message ${error.type} global-error ${error.source ? `source-${error.source}` : ''}`}
        >
          <div className="error-header">
            <span
              className={`error-source ${error.type === 'info' ? 'info-source' : ''}`}
            >
              {error.source || (error.type === 'info' ? 'Success' : 'Error')}
            </span>
            <button
              className={`error-close ${error.type === 'info' ? 'info-close' : ''}`}
              onClick={() => clearError(error.id)}
              title="Dismiss message"
            >
              ×
            </button>
          </div>
          <div className="error-message">{error.message}</div>
          {error.details && (
            <div className="error-details">{error.details}</div>
          )}
          {hasErrors && globalErrors.length > 1 && (
            <button className="clear-all-errors" onClick={clearAllErrors}>
              Clear all messages
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

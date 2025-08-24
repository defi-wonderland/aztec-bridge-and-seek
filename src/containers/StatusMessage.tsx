import React, { useEffect, useRef } from 'react';
import { useAztecWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';

export const StatusMessage: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useAztecWallet();
  const { errors: globalErrors, clearError, clearAllErrors, hasErrors } = useError();

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
  const shouldShow = statusText && isInitialized;

  // Set up auto-dismiss timers for global errors/notifications
  const dismissTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = dismissTimersRef.current;

    const getTimeoutMs = (type: 'error' | 'warning' | 'info') => {
      switch (type) {
        case 'info':
          return 3500;
        case 'warning':
          return 6000;
        case 'error':
        default:
          return 8000;
      }
    };

    // Create timers for any new errors
    globalErrors.forEach((error) => {
      if (!timers[error.id]) {
        timers[error.id] = window.setTimeout(() => {
          clearError(error.id);
          // Clean up reference after clearing
          delete timers[error.id];
        }, getTimeoutMs(error.type));
      }
    });

    // Clear timers for errors that were removed
    Object.keys(timers).forEach((id) => {
      const stillExists = globalErrors.some((e) => e.id === id);
      if (!stillExists) {
        window.clearTimeout(timers[id]);
        delete timers[id];
      }
    });

    return () => {
      // On unmount, clear all timers
      Object.keys(timers).forEach((id) => {
        window.clearTimeout(timers[id]);
        delete timers[id];
      });
    };
  }, [globalErrors, clearError]);

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
        </div>
      )}

      {/* Global Errors */}
      {globalErrors.map((error) => (
        <div 
          key={error.id}
          className={`status-message ${error.type} global-error ${error.source ? `source-${error.source}` : ''}`}
        >
          <div className="error-header">
            <span className={`error-source ${error.type === 'info' ? 'info-source' : ''}`}>
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
            <button 
              className="clear-all-errors"
              onClick={clearAllErrors}
            >
              Clear all messages
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

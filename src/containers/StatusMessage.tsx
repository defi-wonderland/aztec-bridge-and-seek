import React, { useState, useEffect } from 'react';
import { useAztecWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';

export const StatusMessage: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useAztecWallet();
  const { errors: globalErrors, clearError, clearAllErrors, hasErrors } = useError();
  const [visibleErrors, setVisibleErrors] = useState<Set<string>>(new Set());

  // Handle smooth animations for new errors
  useEffect(() => {
    const newErrors = globalErrors.filter(error => !visibleErrors.has(error.id));
    if (newErrors.length > 0) {
      // Add new errors to visible set with a small delay for animation
      const timer = setTimeout(() => {
        setVisibleErrors(prev => new Set([...prev, ...newErrors.map(e => e.id)]));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [globalErrors, visibleErrors]);

  // Remove errors from visible set when they're cleared
  useEffect(() => {
    const currentErrorIds = new Set(globalErrors.map(e => e.id));
    setVisibleErrors(prev => {
      const newSet = new Set(prev);
      for (const id of prev) {
        if (!currentErrorIds.has(id)) {
          newSet.delete(id);
        }
      }
      return newSet;
    });
  }, [globalErrors]);

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
          className={`status-message ${error.type} global-error ${error.source ? `source-${error.source}` : ''} ${
            visibleErrors.has(error.id) ? 'visible' : 'hidden'
          }`}
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
          {error.autoDismiss && (
            <div className="dismiss-progress">
              <div 
                className="dismiss-progress-bar"
                style={{
                  animationDuration: `${(error.dismissTimeout || 5000) / 1000}s`
                }}
              />
            </div>
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

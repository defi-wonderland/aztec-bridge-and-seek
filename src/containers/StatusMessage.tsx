import React from 'react';
import { useAztecWallet } from '../hooks';
import { useNotification } from '../providers/NotificationProvider';

export const StatusMessage: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useAztecWallet();
  const { notifications: globalNotifications, clearNotification, clearAllNotifications, hasNotifications } = useNotification();

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
  if (!shouldShow && !hasNotifications) {
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
      {globalNotifications.map((notification) => (
        <div 
          key={notification.id}
          className={`status-message ${notification.type} global-error ${notification.source ? `source-${notification.source}` : ''}`}
        >
          <div className="error-header">
            <span className={`error-source ${notification.type === 'info' ? 'info-source' : ''}`}>
              {notification.source || (notification.type === 'info' ? 'Success' : 'Error')}
            </span>
            <button 
              className={`error-close ${notification.type === 'info' ? 'info-close' : ''}`}
              onClick={() => clearNotification(notification.id)}
              title="Dismiss message"
            >
              ×
            </button>
          </div>
          <div className="error-message">{notification.message}</div>
          {notification.details && (
            <div className="error-details">{notification.details}</div>
          )}
          {hasNotifications && globalNotifications.length > 1 && (
            <button 
              className="clear-all-errors"
              onClick={clearAllNotifications}
            >
              Clear all messages
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useAztecWallet } from '../hooks';
import { useError, ErrorInfo } from '../providers/ErrorProvider';

interface NotificationProps {
  notification: ErrorInfo;
  onClose: (id: string) => void;
  index: number;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose, index }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Progress bar animation if has timeout
    if (notification.timeout && notification.timeout > 0) {
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - notification.timestamp.getTime();
        const remaining = Math.max(0, notification.timeout - elapsed);
        const progressPercent = (remaining / notification.timeout) * 100;
        setProgress(progressPercent);

        if (remaining <= 0) {
          clearInterval(progressTimer);
        }
      }, 50);

      return () => {
        clearTimeout(enterTimer);
        clearInterval(progressTimer);
      };
    }

    return () => clearTimeout(enterTimer);
  }, [notification.timeout, notification.timestamp]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for exit animation before removing
    setTimeout(() => onClose(notification.id), 200);
  };

  const getIcon = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  return (
    <div 
      className={`notification notification-${notification.type} ${isVisible ? 'notification-visible' : 'notification-hidden'}`}
      style={{ 
        transform: `translateY(-${index * 4}px)`,
        zIndex: 1000 - index 
      }}
    >
      {notification.timeout && notification.timeout > 0 && (
        <div className="notification-progress">
          <div 
            className="notification-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <div className="notification-content">
        <div className="notification-header">
          <div className="notification-icon">
            {getIcon(notification.type)}
          </div>
          <div className="notification-text">
            {notification.source && (
              <div className="notification-source">
                {notification.source}
              </div>
            )}
            <div className="notification-message">
              {notification.message}
            </div>
          </div>
          <button 
            className="notification-close"
            onClick={handleClose}
            title="Close notification"
          >
            ×
          </button>
        </div>
        
        {notification.details && (
          <div className="notification-details">
            {notification.details}
          </div>
        )}
      </div>
    </div>
  );
};

export const NotificationStack: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useAztecWallet();
  const { errors: globalErrors, clearError, addError } = useError();
  const lastWalletError = useRef<string | null>(null);

  // Handle wallet errors
  useEffect(() => {
    if (walletError && isInitialized && walletError !== lastWalletError.current) {
      addError({
        message: walletError,
        type: 'error',
        source: 'wallet'
      });
      lastWalletError.current = walletError;
    }

    // Reset error state when wallet error clears
    if (isInitialized && !walletError) {
      lastWalletError.current = null;
    }
  }, [walletError, isInitialized, addError]);

  if (globalErrors.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack">
      {globalErrors.map((error, index) => (
        <Notification
          key={error.id}
          notification={error}
          onClose={clearError}
          index={index}
        />
      ))}
    </div>
  );
};
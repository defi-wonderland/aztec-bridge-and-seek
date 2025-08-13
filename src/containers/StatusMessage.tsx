import React from 'react';
import { useAztecWallet } from '../hooks';

export const StatusMessage: React.FC = () => {
  const { error, isLoading, isInitialized } = useAztecWallet();

  const renderStatus = () => {
    if (!isInitialized) {
      return 'Initializing Aztec wallet...';
    }

    if (isLoading) {
      return 'Loading...';
    }

    if (error) {
      return error;
    }

    return null;
  };

  const statusText = renderStatus();
  const hasError = error && isInitialized;
  const shouldShow = statusText && isInitialized;

  return (
    <div 
      id="status-message" 
      className={`status-message ${hasError ? 'error' : ''}`}
      style={{ display: shouldShow ? 'block' : 'none' }}
    >
      {statusText}
    </div>
  );
};

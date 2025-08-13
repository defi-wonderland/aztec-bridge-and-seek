import React from 'react';
import { useAztecWallet } from '../hooks';

export const StatusMessage: React.FC = () => {
  const { error, isLoading } = useAztecWallet();

  if (isLoading) {
    return (
      <div id="status-message" className="status-message">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div id="status-message" className="status-message error">
        {error}
      </div>
    );
  }

  return (
    <div id="status-message" className="status-message" style={{ display: 'none' }}></div>
  );
};

import React from 'react';
import { useAztecWallet } from '../hooks';
import { useToken } from '../hooks/context/useToken';

export const TokenBalanceCard: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized
  } = useAztecWallet();
  
  const { 
    isBalanceLoading: isLoading, 
    balanceError: error, 
    setTokenAddress, 
    currentTokenAddress,
    formattedBalances 
  } = useToken();

  // Show balance card only when account is connected and app is initialized
  const showBalanceCard = !!connectedAccount && isInitialized;

  if (!showBalanceCard) {
    return null;
  }

  return (
    <div className="card">
      <h3>Token Balance</h3>
      
      <div className="form-group">
        <label htmlFor="balance-token-address">Token Address:</label>
        <input
          id="balance-token-address"
          type="text"
          value={currentTokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Enter token contract address"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {formattedBalances && (
        <div className="balance-info">
          <h4>Token Balances</h4>
          
          <div className="balance-details">
            <div className="balance-item">
              <span className="balance-label">Private Balance:</span>
              <span className="balance-value">
                {formattedBalances.private}
              </span>
            </div>
            
            <div className="balance-item">
              <span className="balance-label">Public Balance:</span>
              <span className="balance-value">
                {formattedBalances.public}
              </span>
            </div>
            
            <div className="balance-item">
              <span className="balance-label">Total Balance:</span>
              <span className="balance-value">
                {formattedBalances.total}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useToken } from '../hooks/context/useToken';
import { useConfig } from '../hooks';
import { useAztecWallet } from '../hooks/context/useAztecWallet';

export const Sidebar: React.FC = () => {
  const { formattedBalances, isBalanceLoading } = useToken();
  const { currentConfig } = useConfig();
  const { connectedAccount } = useAztecWallet();

  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    
    // Ensure we have the proper format with 0x prefix
    const addressToCopy = text.startsWith('0x') ? text : `0x${text}`;
    
    navigator.clipboard.writeText(addressToCopy).then(() => {
      // Could add a toast notification here if desired
      console.log('Address copied to clipboard:', addressToCopy);
    }).catch(err => {
      console.error('Failed to copy address:', err);
    });
  };

  const truncateAddress = (address: string | undefined) => {
    if (!address) return 'No address set';
    
    // Ensure we have the proper format with 0x prefix
    const formattedAddress = address.startsWith('0x') ? address : `0x${address}`;
    
    if (formattedAddress.length <= 10) return formattedAddress;
    
    // Show 0x + 4 chars + ... + last 4 chars
    return `${formattedAddress.slice(0, 6)}...${formattedAddress.slice(-4)}`;
  };

  const privateBalance = formattedBalances ? parseInt(formattedBalances.private) : 0;
  const publicBalance = formattedBalances ? parseInt(formattedBalances.public) : 0;
  const totalBalance = privateBalance + publicBalance;
  const privatePercentage = totalBalance > 0 ? (privateBalance / totalBalance) * 100 : 0;
  const publicPercentage = totalBalance > 0 ? (publicBalance / totalBalance) * 100 : 0;

  return (
    <aside className="sidebar">
      {/* Token Balance Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="title-icon">💰</span>
            Aztec Token Balance
          </h3>
        </div>
        <div className="card-content">
          {isBalanceLoading ? (
            <div className="balance-loading">
              <div className="loading-spinner"></div>
              <span>Loading balance...</span>
            </div>
          ) : (
            <>
              <div className="balance-items">
                <div className="balance-item">
                  <div className="balance-label">
                    <span className="balance-icon">🛡️</span>
                    <span>Private:</span>
                  </div>
                  <span className="balance-value">{privateBalance}</span>
                </div>
                <div className="balance-item">
                  <div className="balance-label">
                    <span className="balance-icon">🌐</span>
                    <span>Public:</span>
                  </div>
                  <span className="balance-value">{publicBalance}</span>
                </div>

                {/* Visual balance representation */}
                {totalBalance > 0 && (
                  <div className="balance-visual">
                    <div className="balance-bar">
                      {privatePercentage > 0 && (
                        <div
                          className="balance-bar-segment private"
                          style={{ width: `${privatePercentage}%` }}
                        />
                      )}
                      {publicPercentage > 0 && (
                        <div
                          className="balance-bar-segment public"
                          style={{ width: `${publicPercentage}%` }}
                        />
                      )}
                    </div>
                    <div className="balance-percentages">
                      <span>🛡️ {privatePercentage.toFixed(0)}%</span>
                      <span>🌐 {publicPercentage.toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="balance-total">
                <span className="total-label">Total:</span>
                <span className="total-value">{totalBalance}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="title-icon">⚡</span>
            Network Status
          </h3>
        </div>
        <div className="card-content">
          <div className="stats-items">
            <div className="stat-item">
              <span className="stat-label">Network:</span>
              <span className="stat-value">{currentConfig.displayName}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Node URL:</span>
              <span className="stat-value node-url" title={currentConfig.nodeUrl}>
                {currentConfig.nodeUrl}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Address Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">Contract Addresses</h3>
        </div>
        <div className="card-content">
          {connectedAccount && (
            <div className="address-section">
              <label className="address-label">Account Contract:</label>
              <div className="address-input-group">
                <code className="address-display" title={connectedAccount.getAddress().toString()}>
                  {truncateAddress(connectedAccount.getAddress().toString())}
                </code>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(connectedAccount.getAddress().toString())}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
          )}
          <div className="address-section">
            <label className="address-label">Token Contract:</label>
            <div className="address-input-group">
              <code className="address-display" title={currentConfig.tokenContractAddress || 'No address set'}>
                {truncateAddress(currentConfig.tokenContractAddress)}
              </code>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(currentConfig.tokenContractAddress)}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
          <div className="address-section">
            <label className="address-label">Dripper Contract:</label>
            <div className="address-input-group">
              <code className="address-display" title={currentConfig.dripperContractAddress || 'No address set'}>
                {truncateAddress(currentConfig.dripperContractAddress)}
              </code>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(currentConfig.dripperContractAddress)}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

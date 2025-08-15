import React, { useState } from 'react';
import { useAztecWallet } from '../hooks';
import { useToken } from '../hooks/context/useToken';
import { DripperCard } from './DripperCard';
import { VotingCard } from './VotingCard';
import { SettingsCard } from './SettingsCard';

type TabType = 'mint' | 'vote' | 'settings';

export const Layout: React.FC = () => {
  const { connectedAccount, isInitialized } = useAztecWallet();
  const { formattedBalances, currentTokenAddress } = useToken();
  const [activeTab, setActiveTab] = useState<TabType>('mint');

  // Show layout only when account is connected and app is initialized
  const showLayout = !!connectedAccount && isInitialized;

  if (!showLayout) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mint':
        return <DripperCard />;
      case 'vote':
        return <VotingCard />;
      case 'settings':
        return <SettingsCard />;
      default:
        return <DripperCard />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const privateBalance = formattedBalances ? parseInt(formattedBalances.private) : 0;
  const publicBalance = formattedBalances ? parseInt(formattedBalances.public) : 0;
  const totalBalance = privateBalance + publicBalance;
  const privatePercentage = totalBalance > 0 ? (privateBalance / totalBalance) * 100 : 0;
  const publicPercentage = totalBalance > 0 ? (publicBalance / totalBalance) * 100 : 0;

  return (
    <div className="layout-container">
      <div className="layout-grid">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Token Balance Card */}
          <div className="sidebar-card">
            <div className="card-header">
              <h3 className="card-title">
                <span className="title-icon">💰</span>
                Token Balance
              </h3>
            </div>
            <div className="card-content">
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
                  <span className="stat-label">Status:</span>
                  <span className="stat-value connected">Connected</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Network:</span>
                  <span className="stat-value">Local</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Address Card */}
          <div className="sidebar-card">
            <div className="card-header">
              <h3 className="card-title">Contract Address</h3>
            </div>
            <div className="card-content">
              <div className="address-section">
                <label className="address-label">Token Contract:</label>
                <div className="address-input-group">
                  <code className="address-display">
                    {currentTokenAddress || 'No address set'}
                  </code>
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard(currentTokenAddress)}
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Tab Navigation */}
          <div className="tabs-container">
            <div className="tabs-list">
              <button
                className={`tab-trigger ${activeTab === 'mint' ? 'active' : ''}`}
                onClick={() => setActiveTab('mint')}
              >
                <span className="tab-icon">💰</span>
                Mint Tokens
              </button>
              <button
                className={`tab-trigger ${activeTab === 'vote' ? 'active' : ''}`}
                onClick={() => setActiveTab('vote')}
              >
                <span className="tab-icon">🗳️</span>
                Vote
              </button>
              <button
                className={`tab-trigger ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <span className="tab-icon">⚙️</span>
                Settings
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content-wrapper">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

import React from 'react';
import { useEVMWallet } from '../hooks';

export const EVMBalanceCard: React.FC = () => {
  const { account, balance, isBalanceLoading, isSupported } = useEVMWallet();

  if (!isSupported) {
    return (
      <div className="sidebar-card">
        <div className="card-header">
          <div className="card-title">
            <span className="title-icon">💰</span>
            EVM Balance
          </div>
        </div>
        <div className="card-content">
          <span>Network not supported</span>
        </div>
      </div>
    );
  }

  if (!account?.isConnected) {
    return (
      <div className="sidebar-card">
        <div className="card-header">
          <div className="card-title">
            <span className="title-icon">💰</span>
            EVM Balance
          </div>
        </div>
        <div className="card-content">
          <span>Please connect your EVM wallet to view your balance</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-card">
        <div className="card-header">
          <div className="card-title">
            <span className="title-icon">💰</span>
            EVM Balance
          </div>
        </div>
        <div className="card-content">
        <div className="balance-items">
          <div className="balance-item">
            <div className="balance-label">
              <span>ETH:</span>
            </div>
            <span className="balance-value">
            {isBalanceLoading ? (
              <span>Loading...</span>
            ) : balance ? (
              <div className="balance">
                <span className="amount">{Number(balance.formatted).toFixed(4)}</span>
              </div>
            ) : (
              <span>No balance data</span>
            )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

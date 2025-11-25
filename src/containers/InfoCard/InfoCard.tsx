import React, { useEffect } from 'react';
import { useConfig, useContractRegistry } from '../../hooks';
import { useAztecWallet } from '../../hooks/context/useAztecWallet';
import { AddressDisplay, ContractLoadingState } from '../../components';
import { InfoSkeleton } from './InfoSkeleton';

export const InfoCard: React.FC = () => {
  const { currentConfig } = useConfig();
  const { connectedAccount, isInitialized } = useAztecWallet();
  const { registerForTab, areContractsReadyForTab } = useContractRegistry();
  const contractsReady = areContractsReadyForTab('info');

  useEffect(() => {
    if (isInitialized && !contractsReady) {
      registerForTab('info');
    }
  }, [isInitialized, contractsReady, registerForTab]);

  const accountAddress = connectedAccount?.getAddress().toString();

  if (!isInitialized) {
    return <InfoSkeleton />;
  }

  if (!contractsReady) {
    return (
      <ContractLoadingState
        className="info-content"
        icon="ℹ️"
        title="Network & Contract Information"
      />
    );
  }

  return (
    <div className="info-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">ℹ️</span>
        </div>
        <div>
          <h3>Network & Contract Information</h3>
          <p>View network status and contract addresses</p>
        </div>
      </div>

      {/* Network Status Section */}
      <div className="info-section">
        <h4 className="info-section-title">Network Status</h4>
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

      <div className="info-section">
        <h4 className="info-section-title">Contract Addresses</h4>
        {accountAddress && (
          <div className="address-section">
            <label className="address-label">Account Contract:</label>
            <AddressDisplay
              address={accountAddress}
              copyMessage="Account address copied to clipboard"
              className="address-display"
            />
          </div>
        )}
        <div className="address-section">
          <label className="address-label">Token Contract:</label>
          <AddressDisplay
            address={currentConfig.tokenContractAddress}
            copyMessage="Token contract address copied to clipboard"
            className="address-display"
          />
        </div>
        <div className="address-section">
          <label className="address-label">Dripper Contract:</label>
          <AddressDisplay
            address={currentConfig.dripperContractAddress}
            copyMessage="Dripper contract address copied to clipboard"
            className="address-display"
          />
        </div>
      </div>
    </div>
  );
};


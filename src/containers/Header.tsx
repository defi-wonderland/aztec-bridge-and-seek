import React from 'react';
import { useAztecWallet, useConfig } from '../hooks';
import { AccountPill } from '../components/AccountPill';

export const Header: React.FC = () => {
  const {
    connectedAccount: connectedWallet,
    isInitialized,
    createAccount,
    disconnectWallet,
  } = useAztecWallet();

  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();

  const handleCreateAccount = async () => {
    try {
      await createAccount();
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested:', {
      from: currentConfig.name,
      to: networkName,
      currentConfig,
    });

    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };

  const showAccountOptions = !connectedWallet;
  const accountAddress = connectedWallet?.getAddress().toString();

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    if (connectedWallet && accountAddress) {
      return (
        <AccountPill address={accountAddress} onDisconnect={handleDisconnect} />
      );
    }

    return (
      <button
        onClick={handleCreateAccount}
        type="button"
        style={{ display: showAccountOptions ? 'block' : 'none' }}
      >
        Create Account
      </button>
    );
  };

  const renderNetworkSelector = () => {
    const networkOptions = getNetworkOptions();

    return (
      <div className="network-selector">
        <select
          name="network-selector"
          value={currentConfig.name}
          onChange={handleNetworkChange}
          className="network-select"
          title="Select network configuration"
        >
          {networkOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-title">Bridge and Seek</div>

        <div className="nav-controls">
          {renderNetworkSelector()}
          <div className="account-controls">{renderAccountSection()}</div>
        </div>
      </div>
    </nav>
  );
};

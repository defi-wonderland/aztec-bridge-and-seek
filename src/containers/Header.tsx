import React, { useState } from 'react';
import { useAztecWallet, useConfig, useEVMWallet } from '../hooks';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { PasswordModal } from '../components';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    createAccount, 
    connectTestAccount, 
    connectExistingAccount,
    disconnectWallet,
    hasStoredAccount
  } = useAztecWallet();

  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();
  const [testAccountIndex, setTestAccountIndex] = useState(1);
  
  // Password modal states
  const [showCreatePasswordModal, setShowCreatePasswordModal] = useState(false);
  const [showConnectPasswordModal, setShowConnectPasswordModal] = useState(false);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string>('');

  const handleCreateAccount = () => {
    setPasswordError('');
    setShowCreatePasswordModal(true);
  };

  const handleCreateAccountWithPassword = async (password: string) => {
    setIsAccountLoading(true);
    setPasswordError('');
    
    try {
      await createAccount(password);
      setShowCreatePasswordModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setPasswordError(errorMessage);
      console.error('Failed to create account:', err);
    } finally {
      setIsAccountLoading(false);
    }
  };

  const handleConnectTestAccount = async () => {
    try {
      await connectTestAccount(testAccountIndex - 1);
    } catch (err) {
      console.error('Failed to connect test account:', err);
    }
  };

  const handleConnectExisting = () => {
    setPasswordError('');
    setShowConnectPasswordModal(true);
  };

  const handleConnectExistingWithPassword = async (password: string) => {
    setIsAccountLoading(true);
    setPasswordError('');
    
    try {
      await connectExistingAccount(password);
      setShowConnectPasswordModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect account';
      setPasswordError(errorMessage);
      console.error('Failed to connect existing account:', err);
    } finally {
      setIsAccountLoading(false);
    }
  };

  // Auto-initialization is handled by the provider now

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested:', { 
      from: currentConfig.name, 
      to: networkName,
      currentConfig 
    });
    
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };
  
  const showAccountOptions = !connectedAccount;
  const accountAddress = connectedAccount?.getAddress().toString();
  const truncatedAddress = accountAddress ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}` : '';

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <div id="account-display" className="account-display">
            Account: {truncatedAddress}
          </div>
          <button 
            onClick={handleDisconnect}
            type="button"
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <>
        <select 
          id="test-account-number"
          value={testAccountIndex} 
          onChange={(e) => setTestAccountIndex(Number(e.target.value))}
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          <option value="1">Account 1</option>
          <option value="2">Account 2</option>
          <option value="3">Account 3</option>
        </select>
        <button 
          id="connect-test-account"
          onClick={handleConnectTestAccount}
          type="button" 
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          Connect Test Account
        </button>
        <button 
          onClick={handleCreateAccount}
          type="button" 
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          Create Account
        </button>
        {hasStoredAccount() && (
          <button 
            onClick={handleConnectExisting}
            type="button" 
            style={{ display: showAccountOptions ? 'block' : 'none' }}
          >
            Connect Existing Account
          </button>
        )}
      </>
    );
  };

  // No auto-initialization since password is always required
  
  const renderNetworkSelector = () => {
    if (!isInitialized) {
      return null;
    }

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
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-title">Bridge and Seek</div>

          <div className="nav-controls">
            {renderNetworkSelector()}
            <div className="account-controls">
              {renderAccountSection()}
            </div>
            <div className="evm-wallet-controls">
              <ConnectButton showBalance={false} accountStatus="address" />
            </div>
          </div>
        </div>
      </nav>

      <PasswordModal
        isOpen={showCreatePasswordModal}
        title="Create New Account"
        onSubmit={handleCreateAccountWithPassword}
        onCancel={() => setShowCreatePasswordModal(false)}
        isLoading={isAccountLoading}
        error={passwordError}
        placeholder="Enter password for new account"
        submitText="Create Account"
      />

      <PasswordModal
        isOpen={showConnectPasswordModal}
        title="Connect Existing Account"
        onSubmit={handleConnectExistingWithPassword}
        onCancel={() => setShowConnectPasswordModal(false)}
        isLoading={isAccountLoading}
        error={passwordError}
        placeholder="Enter account password"
        submitText="Connect Account"
      />
    </>
  );
};

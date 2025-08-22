import React, { useState } from 'react';
import { useAztecWallet, useEvmWallet } from '../hooks';

export const Header: React.FC = () => {
  const {
    connectedAccount,
    isInitialized,
    createAccount,
    connectTestAccount,
    connectExistingAccount,
    disconnectWallet,
  } = useAztecWallet();
  const {
    isConnected: isEvmConnected,
    address: evmAddress,
    chainId,
    connect: connectEvm,
    disconnect: disconnectEvm,
    switchToBaseSepolia,
  } = useEvmWallet();
  const isOnBaseSepolia = chainId === 84532;

  const [testAccountIndex, setTestAccountIndex] = useState(1);

  const handleCreateAccount = async () => {
    try {
      await createAccount();
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleConnectTestAccount = async () => {
    try {
      await connectTestAccount(testAccountIndex - 1);
    } catch (err) {
      console.error('Failed to connect test account:', err);
    }
  };

  const handleConnectExisting = async () => {
    try {
      await connectExistingAccount();
    } catch (err) {
      console.error('Failed to connect existing account:', err);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const showAccountOptions = !connectedAccount;

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <div id="account-display" className="account-display">
            Account: {connectedAccount.getAddress().toString().slice(0, 6)}...
            {connectedAccount.getAddress().toString().slice(-4)}
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
      </>
    );
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-title">Bridge and Seek</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!isEvmConnected ? (
            <button
              onClick={connectEvm}
              type="button"
              className="connect-button"
            >
              Connect EVM Wallet
            </button>
          ) : (
            <div className="connected-account-section">
              <div className="account-display">
                EVM: {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}
              </div>
              {chainId !== null && !isOnBaseSepolia && (
                <button
                  onClick={switchToBaseSepolia}
                  type="button"
                  className="btn btn-secondary"
                >
                  Switch to Base Sepolia
                </button>
              )}
              <button
                onClick={disconnectEvm}
                type="button"
                className="disconnect-button"
              >
                Disconnect
              </button>
            </div>
          )}
          {renderAccountSection()}
        </div>
      </div>
    </nav>
  );
};

import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig } from '../hooks';
import { WalletModal } from '../components/wallet/WalletModal';
import { PasskeyService } from '../services/passkey/PasskeyService';

export const Header: React.FC = () => {
  const {
    connectedAccount: connectedWallet,
    isInitialized,
    connectTestAccount,
    disconnectWallet
  } = useAztecWallet();

  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();
  const [testAccountIndex, setTestAccountIndex] = useState(1);

  // Show modal immediately when not connected, so user sees contract registration toast
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(!connectedWallet);
  const [hasExistingWallets, setHasExistingWallets] = useState(false);

  // Check IndexedDB for existing passkeys when modal opens
  useEffect(() => {
    const checkForExistingPasskeys = async () => {
      if (isWalletModalOpen) {
        const hasPasskeys = await PasskeyService.hasExistingPasskeys();
        setHasExistingWallets(hasPasskeys);
      }
    };

    checkForExistingPasskeys();
  }, [isWalletModalOpen]);

  // Keep modal open when wallet disconnects or initialization completes without wallet
  useEffect(() => {
    if (!connectedWallet && isInitialized) {
      setIsWalletModalOpen(true);
    }
  }, [connectedWallet, isInitialized]);

  const handleConnectTestAccount = async () => {
    try {
      await connectTestAccount(testAccountIndex - 1);
    } catch (err) {
      console.error('Failed to connect test account:', err);
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
      currentConfig 
    });
    
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };
  
  const showAccountOptions = !connectedWallet;
  const accountAddress = connectedWallet?.getAddress().toString();
  const truncatedAddress = accountAddress ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}` : '';
  const isSandbox = currentConfig.name === 'sandbox';

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    if (connectedWallet) {
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
        {isSandbox && (
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
          </>
        )}
        <button
          onClick={() => setIsWalletModalOpen(true)}
          type="button"
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          Connect Wallet
        </button>
      </>
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
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-title">Bridge and Seek</div>

          <div className="nav-controls">
            {renderNetworkSelector()}
            <div className="account-controls">
              {renderAccountSection()}
            </div>
          </div>
        </div>
      </nav>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onWalletConnected={() => {
          setIsWalletModalOpen(false);
        }}
        hasExistingWallets={hasExistingWallets}
      />
    </>
  );
};

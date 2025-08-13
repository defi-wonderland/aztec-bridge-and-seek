import React, { useState } from 'react';
import { useAztecWallet } from '../hooks';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    createAccount, 
    connectTestAccount, 
    connectExistingAccount 
  } = useAztecWallet();
  
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

  const showAccountOptions = !connectedAccount;

  return (
    <nav className="navbar">
      <div className="nav-title">Private Voting</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {connectedAccount ? (
          <div className="account-display">
            Account: {connectedAccount.getAddress().toString().slice(0, 6)}...{connectedAccount.getAddress().toString().slice(-4)}
          </div>
        ) : (
          <>
            <select 
              value={testAccountIndex} 
              onChange={(e) => setTestAccountIndex(Number(e.target.value))}
              style={{ display: showAccountOptions ? 'block' : 'none' }}
            >
              <option value="1">Account 1</option>
              <option value="2">Account 2</option>
              <option value="3">Account 3</option>
            </select>
            <button 
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
        )}
      </div>
    </nav>
  );
};

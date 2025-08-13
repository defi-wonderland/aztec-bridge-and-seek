import React from 'react';

export const Header: React.FC = () => {
  return (
    <nav className="navbar">
      <div className="nav-title">Private Voting</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div id="account-display" className="account-display"></div>

        <select id="test-account-number" style={{ display: 'none' }}>
          <option value="1">Account 1</option>
          <option value="2">Account 2</option>
          <option value="3">Account 3</option>
        </select>
        <button id="connect-test-account" type="button" style={{ display: 'none' }}>
          Connect Test Account
        </button>
        <button id="create-account" type="button" style={{ display: 'none' }}>
          Create Account
        </button>
      </div>
    </nav>
  );
};

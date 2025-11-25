import React from 'react';

interface AccountPillProps {
  address: string;
  onDisconnect: () => void;
}

export const AccountPill: React.FC<AccountPillProps> = ({ address, onDisconnect }) => {
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="account-pill">
      <span className="account-pill-address">{truncatedAddress}</span>
      <button
        onClick={onDisconnect}
        type="button"
        className="account-pill-disconnect"
        title="Disconnect"
      >
        ⏻
      </button>
    </div>
  );
};

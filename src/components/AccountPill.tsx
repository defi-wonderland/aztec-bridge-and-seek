import React from 'react';
import { useAddressUtils } from '../hooks/useAddressUtils';

interface AccountPillProps {
  address: string;
  onDisconnect: () => void;
}

export const AccountPill: React.FC<AccountPillProps> = ({ address, onDisconnect }) => {
  const { truncateAddress } = useAddressUtils();
  const truncatedAddress = truncateAddress(address);

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

import React from 'react';
import { truncateAddress } from '../utils/address';

interface AddressSelectorProps {
  address?: string;
  placeholder?: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * A clickable address display that opens an address selection modal
 * Shows the address truncated or a placeholder if no address is set
 */
export const AddressSelector: React.FC<AddressSelectorProps> = ({
  address,
  placeholder = 'Select address',
  onClick,
  className = '',
  disabled = false,
}) => {
  const displayText = address ? truncateAddress(address, 8, 6) : placeholder;
  const hasAddress = Boolean(address);

  return (
    <button
      type="button"
      className={`address-selector ${hasAddress ? 'has-address' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={address || placeholder}
    >
      <span className="address-selector-text">{displayText}</span>
      <span className="address-selector-icon">{hasAddress ? '✎' : '↓'}</span>
    </button>
  );
};

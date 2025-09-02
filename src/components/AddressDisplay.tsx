import React from 'react';
import { useAddressUtils } from '../hooks/useAddressUtils';
import { copyToClipboard } from '../utils/clipboard';

interface AddressDisplayProps {
  address: string | undefined;
  showCopy?: boolean;
  onCopy?: () => void;
  className?: string;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  showCopy = true,
  onCopy,
  className = ''
}) => {
  const { truncateAddress, formatAddress } = useAddressUtils();

  const displayAddress = truncateAddress(address);
  const fullAddress = formatAddress(address);

  const handleCopy = async () => {
    const success = await copyToClipboard(address);
    if (success) {
      onCopy?.();
    }
  };

  return (
    <div className={`address-display-container ${className}`}>
      <code className="address-display" title={fullAddress}>
        {displayAddress}
      </code>
      {showCopy && (
        <button
          className="copy-button"
          onClick={handleCopy}
          disabled={!address}
          title="Copy to clipboard"
        >
          📋
        </button>
      )}
    </div>
  );
};
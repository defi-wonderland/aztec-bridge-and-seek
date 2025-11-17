import React from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAddressUtils } from '../hooks/useAddressUtils';
import { copyToClipboard } from '../utils/clipboard';
import { toastService } from '../services/toastService';

interface AddressDisplayProps {
  address: string | AztecAddress | undefined;
  showCopy?: boolean;
  copyMessage?: string;
  onCopy?: () => void;
  className?: string;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  showCopy = true,
  copyMessage,
  onCopy,
  className = ''
}) => {
  const { truncateAddress, formatAddress } = useAddressUtils();

  const displayAddress = truncateAddress(address);
  const fullAddress = formatAddress(address);

  const handleCopy = async () => {
    // Convert AztecAddress to string for copying
    const addressStr = address ? (typeof address === 'string' ? address : address.toString()) : undefined;
    await copyToClipboard(addressStr, {
      onSuccess: () => {
        if (copyMessage) {
          toastService.success(copyMessage);
        }
        onCopy?.();
      },
    });
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
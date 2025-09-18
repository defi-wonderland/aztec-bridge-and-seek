import React from 'react';
import { useAddressUtils } from '../hooks/useAddressUtils';
import { copyToClipboard } from '../utils/clipboard';
import { useNotification } from '../providers/NotificationProvider';

interface AddressDisplayProps {
  address: string | undefined;
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
  const { addNotification } = useNotification();

  const displayAddress = truncateAddress(address);
  const fullAddress = formatAddress(address);

  const handleCopy = async () => {
    await copyToClipboard(address, {
      onSuccess: () => {
        if (copyMessage) {
          addNotification({
            message: copyMessage,
            type: 'success',
          });
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

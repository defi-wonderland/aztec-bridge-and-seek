import React from 'react';

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
  const truncateAddress = (addr: string | undefined): string => {
    if (!addr) return 'No address set';
    
    // Ensure we have the proper format with 0x prefix
    const formattedAddress = addr.startsWith('0x') ? addr : `0x${addr}`;
    
    if (formattedAddress.length <= 10) return formattedAddress;
    
    // Show 0x + 4 chars + ... + last 4 chars
    return `${formattedAddress.slice(0, 6)}...${formattedAddress.slice(-4)}`;
  };

  const handleCopy = () => {
    if (!address) return;
    
    // Ensure we have the proper format with 0x prefix
    const addressToCopy = address.startsWith('0x') ? address : `0x${address}`;
    
    navigator.clipboard.writeText(addressToCopy).then(() => {
      console.log('Address copied to clipboard:', addressToCopy);
      onCopy?.();
    }).catch(err => {
      console.error('Failed to copy address:', err);
    });
  };

  const displayAddress = truncateAddress(address);
  const fullAddress = address ? (address.startsWith('0x') ? address : `0x${address}`) : undefined;

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
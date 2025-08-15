import React, { useState } from 'react';
import { useAztecWallet } from '../hooks';
import { useToken } from '../hooks/context/useToken';

export const DripperCard: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    dripperService
  } = useAztecWallet();
  
  const { refreshBalance, currentTokenAddress, setTokenAddress, clearTokenAddress } = useToken();
  
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dripType, setDripType] = useState<'private' | 'public'>('private');

  const handleDrip = async () => {
    if (!currentTokenAddress || !amount || !dripperService) return;

    setIsProcessing(true);
    try {
      const amountBigInt = BigInt(amount);
      
      if (dripType === 'private') {
        await dripperService.dripToPrivate(currentTokenAddress, amountBigInt);
      } else {
        await dripperService.dripToPublic(currentTokenAddress, amountBigInt);
      }
      
      // Refresh balance after successful drip
      await refreshBalance();
      
      // Clear form after successful drip
      clearTokenAddress();
      setAmount('');
    } catch (err) {
      console.error('Failed to drip tokens:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncPrivateState = async () => {
    if (!dripperService) return;

    setIsProcessing(true);
    try {
      await dripperService.syncPrivateState();
    } catch (err) {
      console.error('Failed to sync private state:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Show dripper form only when account is connected and app is initialized
  const showDripForm = !!connectedAccount && isInitialized;

  if (!showDripForm) {
    return null;
  }

  return (
    <div className="card">
      <h3>Dripper - Mint Tokens</h3>
      
      <form className="drip-form">
        <div className="form-group">
          <label htmlFor="token-address">Token Address:</label>
          <input
            id="token-address"
            type="text"
            value={currentTokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="Enter token contract address"
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount:</label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount to mint"
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="drip-type">Drip Type:</label>
          <select
            id="drip-type"
            value={dripType}
            onChange={(e) => setDripType(e.target.value as 'private' | 'public')}
            disabled={isProcessing}
          >
            <option value="private">Private Balance</option>
            <option value="public">Public Balance</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleDrip}
          disabled={!currentTokenAddress || !amount || isProcessing}
          className="btn btn-primary"
        >
          {isProcessing ? 'Processing...' : `Drip to ${dripType}`}
        </button>
      </form>

      <div className="sync-section">
        <h4>Private State Management</h4>
        <button
          onClick={handleSyncPrivateState}
          disabled={isProcessing}
          className="btn btn-secondary"
        >
          {isProcessing ? 'Processing...' : 'Sync Private State'}
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../hooks';
import { useToken } from '../hooks/context/useToken';
import { ValidatedNumberInput } from '../components';
import type { ValidationResult } from '../types';
import { toastService } from '../services/toastService';

export const DripperCard: React.FC = () => {
  const { connectedAccount, isInitialized, dripperService } = useAztecWallet();

  const { refreshBalance, currentTokenAddress, setTokenAddress } = useToken();

  const [amountState, setAmountState] = useState<ValidationResult>({
    success: true,
    value: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [dripType, setDripType] = useState<'private' | 'public'>('private');

  const handleAmountChange = (result: ValidationResult) => {
    setAmountState(result);
  };

  const handleDrip = async () => {
    if (!currentTokenAddress || !amountState.value || !dripperService) {
      toastService.error('❌ Missing token address or dripper service');
      return;
    }
    setIsProcessing(true);
    const targetLabel =
      dripType === 'private' ? 'private balance' : 'public balance';
    const loadingToastId = toastService.loading(
      dripType === 'private'
        ? '🔐 Minting to private balance...'
        : '🌐 Minting to public balance...'
    );
    try {
      const amountBigInt = BigInt(amountState.value);

      if (dripType === 'private') {
        await dripperService.dripToPrivate(currentTokenAddress, amountBigInt);
      } else {
        await dripperService.dripToPublic(currentTokenAddress, amountBigInt);
      }

      // Refresh balance after successful drip
      await refreshBalance();

      // Show success message
      toastService.dismiss(loadingToastId);
      toastService.success(
        `✅ Successfully minted ${amountState.value} tokens to ${targetLabel}`,
        {
          autoClose: 4000,
        }
      );

      // Clear form after successful drip
      setAmountState({ success: true, value: '' });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to mint tokens';
      console.error('❌ Dripper error:', errorMessage);
      toastService.dismiss(loadingToastId);
      toastService.error('Failed to mint tokens', {
        autoClose: 7000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncPrivateState = async () => {
    if (!dripperService) return;

    setIsProcessing(true);
    try {
      await dripperService.syncPrivateState();

      // Show success message
      toastService.success('Successfully synced private state', {
        autoClose: 4000,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sync private state';
      toastService.error(errorMessage, {
        autoClose: 7000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show dripper form only when account is connected and app is initialized
  const isDripperDisabled =
    !connectedAccount ||
    !isInitialized ||
    isProcessing ||
    !currentTokenAddress ||
    !amountState.success ||
    !amountState.value;

  return (
    <div className="dripper-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">💰</span>
        </div>
        <div>
          <h3>Dripper - Mint Tokens</h3>
          <p>Mint new tokens to your balance</p>
        </div>
      </div>

      <div className="mint-form-container">
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="token-address">Token Address</label>
            <div className="input-with-copy">
              <input
                id="token-address"
                type="text"
                value={currentTokenAddress?.toString() || ''}
                onChange={(e) => {
                  try {
                    setTokenAddress(AztecAddress.fromString(e.target.value));
                  } catch (error) {
                    console.error('Invalid Aztec address:', e.target.value);
                  }
                }}
                placeholder="Enter token contract address"
                disabled={isProcessing}
                className="form-input"
              />
              <button
                type="button"
                className="copy-button"
                onClick={() =>
                  navigator.clipboard.writeText(currentTokenAddress.toString())
                }
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>

          <ValidatedNumberInput
            id="amount"
            label="Amount"
            value={amountState.value}
            onChange={handleAmountChange}
            placeholder="Enter amount to mint"
            disabled={isProcessing}
          />

          <div className="form-group">
            <label htmlFor="drip-type">Drip Type</label>
            <select
              id="drip-type"
              value={dripType}
              onChange={(e) =>
                setDripType(e.target.value as 'private' | 'public')
              }
              disabled={isProcessing}
              className="form-select"
            >
              <option value="private">Private Balance</option>
              <option value="public">Public Balance</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleDrip}
            disabled={isDripperDisabled}
            className="btn btn-primary"
          >
            <span className="btn-icon">
              {dripType === 'private' ? '🛡️' : '🌐'}
            </span>
            {isProcessing ? 'Processing...' : `Drip to ${dripType}`}
          </button>
        </div>
      </div>
    </div>
  );
};

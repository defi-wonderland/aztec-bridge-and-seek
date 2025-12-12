import React from 'react';
import {
  formatBalance,
  formatBalanceFull,
  sanitizeNumericInput,
} from '../../utils/format';
import { Tooltip } from '../Tooltip';

export type SwapPanelProps = {
  title: string;
  inputId: string;
  tokenName: string;
  amount: string;
  onAmountChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  onTokenClick?: () => void;
  isLoading?: boolean;
  helperText?: string;
  helperStatus?: 'default' | 'error';
  readOnly?: boolean;
  balance?: bigint | null;
  isLoadingBalance?: boolean;
  decimals?: number;
  insufficientBalance?: boolean;
};

export const SwapPanel: React.FC<SwapPanelProps> = ({
  title,
  inputId,
  tokenName,
  amount,
  onAmountChange,
  onTokenClick,
  disabled,
  isLoading,
  helperText,
  helperStatus = 'default',
  readOnly,
  balance,
  isLoadingBalance,
  decimals = 18,
  insufficientBalance,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeNumericInput(e.target.value);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
    onAmountChange?.(e);
  };

  return (
    <div
      className={`swap-panel${insufficientBalance ? ' swap-panel--error' : ''}`}
    >
      <div className="swap-panel-header">
        <span className="swap-label">{title}</span>
        <div className="swap-balance">
          {isLoadingBalance && <span className="swap-balance-skeleton" />}

          {!isLoadingBalance && (
            <Tooltip content={formatBalanceFull(balance, decimals, tokenName)}>
              <span
                className={`swap-balance-text${insufficientBalance ? ' swap-balance-text--error' : ''}`}
              >
                Balance: {formatBalance(balance, decimals)}
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="swap-token-row">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          className={`amount-input swap-amount-input${insufficientBalance ? ' swap-amount-input--error' : ''}`}
          placeholder="0.0"
          value={amount}
          onChange={handleInputChange}
          disabled={disabled}
          readOnly={readOnly}
          aria-busy={isLoading || undefined}
        />
        <button
          type="button"
          className="swap-token-button"
          onClick={onTokenClick}
          disabled={disabled}
        >
          <span className="token-text">{tokenName}</span>
          <span className="token-caret">▾</span>
        </button>
      </div>

      {insufficientBalance && (
        <p className="swap-helper-text swap-helper-text--error">
          Insufficient balance
        </p>
      )}

      {isLoading && !insufficientBalance && (
        <div className="swap-amount-loader" aria-live="polite">
          <span className="swap-amount-loader__spinner" />
        </div>
      )}

      {helperText && !insufficientBalance && (
        <p
          className={`swap-helper-text${helperStatus === 'error' ? ' swap-helper-text--error' : ''}`}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default SwapPanel;

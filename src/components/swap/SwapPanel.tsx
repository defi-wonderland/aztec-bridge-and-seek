import React from 'react';

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
}) => (
  <div className="swap-panel">
    <div className="swap-panel-header">
      <span className="swap-label">{title}</span>
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
    <div className="swap-amount">
      <input
        id={inputId}
        type="text"
        className="amount-input swap-amount-input"
        placeholder="0.0"
        value={amount}
        onChange={(e) => onAmountChange?.(e)}
        disabled={disabled}
        readOnly={readOnly}
        aria-busy={isLoading || undefined}
      />
      {isLoading && (
        <div className="swap-amount-loader" aria-live="polite">
          <span className="swap-amount-loader__spinner" />
        </div>
      )}
    </div>
    {helperText && (
      <p
        className={`swap-helper-text${
          helperStatus === 'error' ? ' swap-helper-text--error' : ''
        }`}
      >
        {helperText}
      </p>
    )}
  </div>
);

export default SwapPanel;

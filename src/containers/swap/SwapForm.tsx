import React, { useState } from 'react';
import { Modal, ModalOption, SwapProgress } from '../../components';
import { useSwapPair, useSwapFlow } from '../../hooks';

type SwapPanelProps = {
  title: string;
  inputId: string;
  tokenName: string;
  amount: string;
  onAmountChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  onTokenClick?: () => void;
};

const SwapPanel: React.FC<SwapPanelProps> = ({
  title,
  inputId,
  tokenName,
  amount,
  onAmountChange,
  onTokenClick,
  disabled,
}) => (
  <div className="swap-panel">
    <div className="swap-panel-header">
      <span className="swap-label">{title}</span>
      <button
        type="button"
        className="swap-token-button"
        onClick={onTokenClick}
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
      />
    </div>
  </div>
);

export const SwapForm: React.FC = () => {
  const {
    tokenA,
    tokenB,
    amountA,
    switchTokens,
    selectToken,
    handleAmountChangeFrom,
    handleAmountChangeTo,
    amountFrom,
    amountTo,
  } = useSwapPair();

  const [activeModal, setActiveModal] = useState<
    'token' | 'protocol' | 'bridge' | 'confirm' | null
  >(null);
  const [activeTokenSide, setActiveTokenSide] = useState<'A' | 'B' | null>(
    null
  );

  const selectedTokenOnModal =
    activeTokenSide === null ? null : activeTokenSide === 'A' ? tokenA : tokenB;

  const openTokenModal = (side: 'A' | 'B') => {
    setActiveTokenSide(side);
    setActiveModal('token');
  };

  const closeTokenModal = () => {
    setActiveModal(null);
    setActiveTokenSide(null);
  };

  const handleModalSelectToken = (token: 'AZTC' | 'WETH') => {
    if (!activeTokenSide) return;
    selectToken(activeTokenSide, token);
    closeTokenModal();
  };

  // Swap flow state
  const { isSwapping, activeStep, isClaimLoading, startSwap, handleClaim } =
    useSwapFlow();

  return (
    <div className="bridge-form">
      <div className="swap-stack">
        <SwapPanel
          title="From"
          inputId="swap-amount-a"
          amount={amountFrom}
          tokenName={tokenA}
          onAmountChange={handleAmountChangeFrom}
          onTokenClick={() => openTokenModal('A')}
        />

        <div className="swap-arrow-row">
          <button
            type="button"
            className="swap-arrow-button"
            aria-label="Swap token order"
            title="Swap token order"
            onClick={switchTokens}
          >
            ⇅
          </button>
        </div>

        <SwapPanel
          title="To"
          inputId="swap-amount-b"
          amount={amountTo}
          tokenName={tokenB}
          onAmountChange={handleAmountChangeTo}
          onTokenClick={() => openTokenModal('B')}
        />
      </div>

      <div className="token-row">
        <div className="token-section">
          <div className="token-info">
            <span className="token-label">Protocol</span>
            <button
              type="button"
              className="connect-evm-button"
              onClick={() => setActiveModal('protocol')}
            >
              Uniswap
            </button>
          </div>
        </div>

        <div className="token-section">
          <div className="token-info">
            <span className="token-label">Bridge</span>
            <button
              type="button"
              className="connect-aztec-button"
              onClick={() => setActiveModal('bridge')}
            >
              Substance
            </button>
          </div>
        </div>
      </div>

      {activeStep > 0 && activeStep < 4 && (
        <SwapProgress
          amountFrom={amountFrom}
          tokenFrom={tokenA}
          amountTo={amountTo}
          tokenTo={tokenB}
          step={activeStep as 1 | 2 | 3}
          onClaim={handleClaim}
          isClaimLoading={isClaimLoading}
        />
      )}

      <button
        className="bridge-button"
        type="button"
        onClick={() => setActiveModal('confirm')}
        disabled={isSwapping || !(Number(amountA) > 0)}
      >
        {isSwapping ? 'Processing…' : 'Swap'}
      </button>
      <Modal
        isOpen={activeModal === 'confirm'}
        title="Confirm swap"
        onClose={() => setActiveModal(null)}
      >
        <div className="confirm-list">
          <div className="confirm-row">
            <span className="confirm-label">You will send</span>
            <span className="confirm-value">
              {amountFrom || '0'} {tokenA}
            </span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">You will receive</span>
            <span className="confirm-value">
              {amountTo || '0'} {tokenB}
            </span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">Protocol</span>
            <span className="confirm-value">Uniswap</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">Chain</span>
            <span className="confirm-value">Base Sepolia</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">Bridge</span>
            <span className="confirm-value">Substance</span>
          </div>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setActiveModal(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="connect-evm-button"
            onClick={() => {
              setActiveModal(null);
              startSwap();
            }}
            disabled={isSwapping}
          >
            Confirm
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={activeModal === 'token'}
        title="Select token"
        description="Select the token you want to swap."
        onClose={closeTokenModal}
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ModalOption
            label="AZTC"
            description="Aztec Token"
            selected={selectedTokenOnModal === 'AZTC'}
            onClick={() => handleModalSelectToken('AZTC')}
          />
          <ModalOption
            label="WETH"
            description="Wrapped Ether"
            selected={selectedTokenOnModal === 'WETH'}
            onClick={() => handleModalSelectToken('WETH')}
          />
        </div>
      </Modal>
      <Modal
        isOpen={activeModal === 'protocol'}
        title="Select protocol"
        description="Select the protocol you want to use."
        onClose={() => setActiveModal(null)}
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ModalOption label="Uniswap" selected />
        </div>
      </Modal>
      <Modal
        isOpen={activeModal === 'bridge'}
        title="Select bridge"
        description="Select the bridge you want to use."
        onClose={() => setActiveModal(null)}
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ModalOption label="Substance" selected />
        </div>
      </Modal>
    </div>
  );
};

export default SwapForm;

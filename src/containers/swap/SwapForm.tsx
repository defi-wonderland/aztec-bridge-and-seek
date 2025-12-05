import React, { useState } from 'react';
import { SwapProgress } from '../../components';
import { SwapPanel } from '../../components/swap/SwapPanel';
import {
  ConfirmSwapModal,
  TokenSelectModal,
  ProtocolSelectModal,
  BridgeSelectModal,
  SettingsModal,
} from '../../components/swap/modals';
import { useSwapPair, useSwapFlow, useSwapSettings } from '../../hooks/swap';
import { useBridgeSwap } from '../../hooks/useBridgeSwap';

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
    isAutoQuoteActive,
    isAutoQuoteLoading,
    autoQuoteError,
  } = useSwapPair();

  const [activeModal, setActiveModal] = useState<
    'token' | 'protocol' | 'bridge' | 'confirm' | 'settings' | null
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

  const handleModalSelectToken = (token: 'WETH' | 'USDC') => {
    if (!activeTokenSide) return;
    selectToken(activeTokenSide, token);
    closeTokenModal();
  };

  // Swap flow state
  const { isSwapping, activeStep, startSwap, txHashes, setFlowStep } =
    useSwapFlow();

  // Snapshot of swap values when initiated (so they don't change during/after swap)
  const [swapSnapshot, setSwapSnapshot] = useState<{
    amountFrom: string;
    amountTo: string;
    tokenFrom: string;
    tokenTo: string;
  } | null>(null);

  // Swap settings (slippage)
  const {
    slippage,
    slippagePreset,
    setSlippagePreset,
    setCustomSlippage,
    warning: slippageWarning,
    isCustom: isCustomSlippage,
    calculateMinReceived,
  } = useSwapSettings();
  const [customSlippageInput, setCustomSlippageInput] = useState('');

  // const {
  //   balance: wethBalance,
  //   usdcBalance,
  //   isLoading: isLoadingUsdc,
  //   refetch: refetchUsdcBalance,
  // } = useWethBalance();

  const { swap, isReady: isBridgeSwapReady } = useBridgeSwap();

  return (
    <div className="bridge-form">
      {/* <div className="balance-summary">
        <h3>Balances</h3>
        {isLoadingUsdc ? (
          <p>Cargando balances...</p>
        ) : (
          <div className="balance-list">
            <div className="balance-row">
              <span>WETH</span>
              <span>{usdcBalance?.toString()}</span>
            </div>
            <div className="balance-row">
              <span>USDC</span>
              <span>{wethBalance?.toString()}</span>
            </div>
            <button type="button" onClick={swap} disabled={!isBridgeSwapReady}>
              Swap
            </button>
            {!isBridgeSwapReady && (
              <small>Please connect Aztec & EVM wallets to enable swap.</small>
            )}
          </div>
        )}
      </div> */}

      <div className="swap-header">
        <span className="swap-header-title">Swap</span>
        <button
          type="button"
          className="swap-settings-button"
          onClick={() => setActiveModal('settings')}
          aria-label="Swap settings"
        >
          ⚙️
        </button>
      </div>

      <div className="swap-stack">
        <SwapPanel
          title="From"
          inputId="swap-amount-a"
          amount={amountFrom}
          tokenName={tokenA}
          onAmountChange={handleAmountChangeFrom}
          onTokenClick={() => openTokenModal('A')}
          disabled={isSwapping}
        />

        <div className="swap-arrow-row">
          <button
            type="button"
            className="swap-arrow-button"
            aria-label="Swap token order"
            title="Swap token order"
            disabled={isSwapping}
          >
            ⇅
          </button>
        </div>

        <SwapPanel
          title="To"
          inputId="swap-amount-b"
          amount={amountTo}
          tokenName={tokenB}
          onAmountChange={isAutoQuoteActive ? undefined : handleAmountChangeTo}
          onTokenClick={() => openTokenModal('B')}
          isLoading={isAutoQuoteActive && isAutoQuoteLoading && !isSwapping}
          helperText={autoQuoteError || undefined}
          helperStatus={autoQuoteError ? 'error' : 'default'}
          readOnly={isAutoQuoteActive}
          disabled={isSwapping}
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

      {activeStep > 0 && activeStep <= 5 && swapSnapshot && (
        <SwapProgress
          amountFrom={swapSnapshot.amountFrom}
          tokenFrom={swapSnapshot.tokenFrom}
          amountTo={swapSnapshot.amountTo}
          tokenTo={swapSnapshot.tokenTo}
          step={activeStep as 1 | 2 | 3 | 4 | 5}
          txHashes={txHashes}
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
      <ConfirmSwapModal
        isOpen={activeModal === 'confirm'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => {
          // Save snapshot of current values
          setSwapSnapshot({
            amountFrom,
            amountTo,
            tokenFrom: tokenA,
            tokenTo: tokenB,
          });
          setActiveModal(null);
          startSwap();
          swap(setFlowStep);
        }}
        amountFrom={amountFrom}
        amountTo={amountTo}
        tokenFrom={tokenA}
        tokenTo={tokenB}
        minReceived={calculateMinReceived(amountTo)}
        slippage={slippage}
        isSwapping={isSwapping}
      />
      <TokenSelectModal
        isOpen={activeModal === 'token'}
        onClose={closeTokenModal}
        onSelect={handleModalSelectToken}
        selectedToken={selectedTokenOnModal}
        disabledToken={activeTokenSide === 'A' ? tokenB : tokenA}
      />
      <ProtocolSelectModal
        isOpen={activeModal === 'protocol'}
        onClose={() => setActiveModal(null)}
      />
      <BridgeSelectModal
        isOpen={activeModal === 'bridge'}
        onClose={() => setActiveModal(null)}
      />
      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        slippage={slippage}
        slippagePreset={slippagePreset}
        setSlippagePreset={setSlippagePreset}
        setCustomSlippage={setCustomSlippage}
        slippageWarning={slippageWarning}
        isCustomSlippage={isCustomSlippage}
        customSlippageInput={customSlippageInput}
        setCustomSlippageInput={setCustomSlippageInput}
      />
    </div>
  );
};

export default SwapForm;

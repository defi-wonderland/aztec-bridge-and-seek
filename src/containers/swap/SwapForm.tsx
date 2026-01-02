import React, { useState } from 'react';
import { formatUnits, parseUnits } from 'viem';

import { getTokenDecimals } from '../../config';
import { SwapProgress } from '../../components';
import { SwapPanel } from '../../components/swap/SwapPanel';
import {
  ConfirmSwapModal,
  TokenSelectModal,
  ProtocolSelectModal,
  BridgeSelectModal,
  SettingsModal,
} from '../../components/swap/modals';
import { SWAP_STEPS } from '../../components/swap/constants';
import { useSwapPair, useSwapFlow, useSwapSettings } from '../../hooks/swap';
import { useBridgeSwap } from '../../hooks/useBridgeSwap';
import { useWethBalance } from '../../hooks/useWethBalance';
import { Token } from '../../components/swap/modals/TokenSelectModal';
import { toastService } from '../../services/toastService';

export const SwapForm: React.FC = () => {
  const {
    tokenA,
    tokenB,
    amountA,
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
  const {
    isSwapping,
    activeStep,
    errorStep,
    startSwap,
    txHashes,
    setFlowStep,
    setErrorStep,
  } = useSwapFlow();

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

  // Token balances
  const {
    wethBalance,
    usdcBalance,
    isLoading: isLoadingBalances,
    refetch: refetchBalances,
  } = useWethBalance();

  const { swap } = useBridgeSwap({
    onSuccess: refetchBalances,
  });

  // Get balance for a specific token
  const getBalanceForToken = (token: Token): bigint | null => {
    if (token === 'WETH') return wethBalance;
    if (token === 'USDC') return usdcBalance;
    return null;
  };

  // Check if input amount exceeds balance (insufficient balance)
  const hasInsufficientBalance = (() => {
    const balance = getBalanceForToken(tokenA);
    if (!balance || !amountFrom || amountFrom === '') return false;
    try {
      const inputAmount = parseFloat(amountFrom);
      if (isNaN(inputAmount) || inputAmount <= 0) return false;
      const balanceFormatted = parseFloat(
        formatUnits(balance, getTokenDecimals(tokenA))
      );
      return inputAmount > balanceFormatted;
    } catch {
      return false;
    }
  })();

  return (
    <div className="bridge-form">
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
          balance={getBalanceForToken(tokenA)}
          isLoadingBalance={isLoadingBalances}
          decimals={getTokenDecimals(tokenA)}
          insufficientBalance={hasInsufficientBalance}
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
          balance={getBalanceForToken(tokenB)}
          isLoadingBalance={isLoadingBalances}
          decimals={getTokenDecimals(tokenB)}
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

      {activeStep > SWAP_STEPS.IDLE &&
        activeStep <= SWAP_STEPS.COMPLETED &&
        swapSnapshot && (
          <SwapProgress
            amountFrom={swapSnapshot.amountFrom}
            tokenFrom={swapSnapshot.tokenFrom}
            amountTo={swapSnapshot.amountTo}
            tokenTo={swapSnapshot.tokenTo}
            step={activeStep}
            errorStep={errorStep}
            txHashes={txHashes}
          />
        )}

      <button
        className="bridge-button"
        type="button"
        onClick={() => setActiveModal('confirm')}
        disabled={
          isSwapping ||
          isLoadingBalances ||
          !(Number(amountA) > 0) ||
          hasInsufficientBalance
        }
      >
        {isSwapping
          ? 'Processing…'
          : hasInsufficientBalance
            ? 'Insufficient balance'
            : 'Swap'}
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
          swap({
            amount: parseUnits(amountFrom || '0', 18),
            setFlowStep,
            onError: (step) => {
              setErrorStep(step);
              toastService.error(
                'Something went wrong. Please try again in a moment.'
              );
            },
          });
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

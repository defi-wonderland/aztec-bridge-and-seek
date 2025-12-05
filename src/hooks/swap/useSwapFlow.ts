import { useCallback, useState } from 'react';

export type SwapStep = 0 | 1 | 2 | 3 | 4 | 5;

export type SetFlowStepOptions = {
  isSwapping?: boolean;
  txHash?: string;
  hashStep?: SwapStep;
};

export type SwapFlowTxHashes = {
  bridgeOut?: string;
  swap?: string;
  bridgeIn?: string;
  claim?: string;
};

export type UseSwapFlowResult = {
  isSwapping: boolean;
  activeStep: SwapStep;
  txHashes: SwapFlowTxHashes;
  startSwap: () => void;
  setFlowStep: (step: SwapStep, options?: SetFlowStepOptions) => void;
  resetFlow: () => void;
};

/**
 * useSwapFlow
 * Minimal state container for the swap lifecycle.
 * Consumers can drive the exact step transitions via setFlowStep.
 */
export function useSwapFlow(): UseSwapFlowResult {
  const [isSwapping, setIsSwapping] = useState(false);
  const [activeStep, setActiveStep] = useState<SwapStep>(0);
  const [txHashes, setTxHashes] = useState<SwapFlowTxHashes>({});

  const assignTxHashForStep = useCallback((step: SwapStep, hash?: string) => {
    if (!hash || step < 1) return;
    setTxHashes((prev) => {
      switch (step) {
        case 1:
          if (prev.bridgeOut === hash) return prev;
          return { ...prev, bridgeOut: hash };
        case 2:
          if (prev.swap === hash) return prev;
          return { ...prev, swap: hash };
        case 3:
          if (prev.bridgeIn === hash) return prev;
          return { ...prev, bridgeIn: hash };
        case 4:
          if (prev.claim === hash) return prev;
          return { ...prev, claim: hash };
        default:
          return prev;
      }
    });
  }, []);

  const setFlowStep = useCallback(
    (step: SwapStep, options?: SetFlowStepOptions) => {
      setActiveStep(step);

      // Step 5 = completed, automatically stop swapping
      if (step === 5) {
        setIsSwapping(false);
      } else if (options && 'isSwapping' in options) {
        setIsSwapping(options.isSwapping ?? false);
      }

      if (options?.txHash) {
        const targetStep =
          options.hashStep !== undefined
            ? options.hashStep
            : ((step - 1) as SwapStep);
        assignTxHashForStep(targetStep, options.txHash);
      }
    },
    [assignTxHashForStep]
  );

  const startSwap = useCallback(() => {
    // Reset previous flow before starting a new one
    setTxHashes({});
    setFlowStep(1, { isSwapping: true });
  }, [setFlowStep]);

  const resetFlow = useCallback(() => {
    setActiveStep(0);
    setIsSwapping(false);
    setTxHashes({});
  }, []);

  return {
    isSwapping,
    activeStep,
    txHashes,
    startSwap,
    setFlowStep,
    resetFlow,
  };
}

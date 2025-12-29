import { useCallback, useState } from 'react';

import {
  SWAP_STEPS,
  SwapStep,
  ActiveSwapStep,
} from '../../components/swap/constants';

// Re-export for backwards compatibility
export type { SwapStep, ActiveSwapStep } from '../../components/swap/constants';
export { SWAP_STEPS } from '../../components/swap/constants';

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
  errorStep: ActiveSwapStep | null;
  txHashes: SwapFlowTxHashes;
  startSwap: () => void;
  setFlowStep: (step: SwapStep, options?: SetFlowStepOptions) => void;
  setErrorStep: (step: ActiveSwapStep) => void;
  resetFlow: () => void;
};

/**
 * useSwapFlow
 * Minimal state container for the swap lifecycle.
 * Consumers can drive the exact step transitions via setFlowStep.
 */
export function useSwapFlow(): UseSwapFlowResult {
  const [isSwapping, setIsSwapping] = useState(false);
  const [activeStep, setActiveStep] = useState<SwapStep>(SWAP_STEPS.IDLE);
  const [errorStep, setErrorStepState] = useState<ActiveSwapStep | null>(null);
  const [txHashes, setTxHashes] = useState<SwapFlowTxHashes>({});

  const assignTxHashForStep = useCallback((step: SwapStep, hash?: string) => {
    if (!hash || step < SWAP_STEPS.BRIDGE_OUT) return;
    setTxHashes((prev) => {
      switch (step) {
        case SWAP_STEPS.BRIDGE_OUT:
          if (prev.bridgeOut === hash) return prev;
          return { ...prev, bridgeOut: hash };
        case SWAP_STEPS.SWAP:
          if (prev.swap === hash) return prev;
          return { ...prev, swap: hash };
        case SWAP_STEPS.BRIDGE_IN:
          if (prev.bridgeIn === hash) return prev;
          return { ...prev, bridgeIn: hash };
        case SWAP_STEPS.CLAIM:
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

      // Completed step automatically stops swapping
      if (step === SWAP_STEPS.COMPLETED) {
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
    setErrorStepState(null);
    setFlowStep(SWAP_STEPS.BRIDGE_OUT, { isSwapping: true });
  }, [setFlowStep]);

  const setErrorStep = useCallback((step: ActiveSwapStep) => {
    setErrorStepState(step);
    setIsSwapping(false);
  }, []);

  const resetFlow = useCallback(() => {
    setActiveStep(SWAP_STEPS.IDLE);
    setIsSwapping(false);
    setErrorStepState(null);
    setTxHashes({});
  }, []);

  return {
    isSwapping,
    activeStep,
    errorStep,
    txHashes,
    startSwap,
    setFlowStep,
    setErrorStep,
    resetFlow,
  };
}

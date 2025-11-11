import { useCallback, useEffect, useRef, useState } from 'react';

export type SwapStep = 0 | 1 | 2 | 3 | 4;

export type UseSwapFlowOptions = {
  step1DelayMs?: number; // 0 -> 1 happens immediately on start
  step2DelayMs?: number; // delay to go from 1 -> 2
  step3DelayMs?: number; // delay to go from 2 -> 3
  claimDelayMs?: number; // delay during claim to go 3 -> 4
  resetDelayMs?: number; // delay to reset 4 -> 0
};

export type UseSwapFlowResult = {
  isSwapping: boolean;
  activeStep: SwapStep;
  isClaimLoading: boolean;
  startSwap: () => void;
  handleClaim: () => void;
};

/**
 * useSwapFlow
 * Controls swapping lifecycle: start -> step progression -> claim -> complete -> reset.
 */
export function useSwapFlow(options?: UseSwapFlowOptions): UseSwapFlowResult {
  const {
    step2DelayMs = 3000,
    step3DelayMs = 4000,
    claimDelayMs = 3000,
    resetDelayMs = 300,
  } = options || {};

  const [isSwapping, setIsSwapping] = useState(false);
  const [activeStep, setActiveStep] = useState<SwapStep>(0);
  const [isClaimLoading, setIsClaimLoading] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pushTimer = (t: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(t);
  };

  const clearAllTimers = () => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const startSwap = useCallback(() => {
    clearAllTimers();
    setIsSwapping(true);
    setActiveStep(1);
    // 1 -> 2
    pushTimer(
      setTimeout(() => {
        setActiveStep(2);
        // 2 -> 3
        pushTimer(
          setTimeout(() => {
            setActiveStep(3);
          }, step3DelayMs)
        );
      }, step2DelayMs)
    );
  }, [step2DelayMs, step3DelayMs]);

  const handleClaim = useCallback(() => {
    if (activeStep !== 3 || isClaimLoading) return;
    setIsClaimLoading(true);
    pushTimer(
      setTimeout(() => {
        setIsClaimLoading(false);
        setActiveStep(4);
        setIsSwapping(false);
        // Reset back to 0 after brief delay
        pushTimer(
          setTimeout(() => {
            setActiveStep(0);
          }, resetDelayMs)
        );
      }, claimDelayMs)
    );
  }, [activeStep, claimDelayMs, isClaimLoading, resetDelayMs]);

  return { isSwapping, activeStep, isClaimLoading, startSwap, handleClaim };
}

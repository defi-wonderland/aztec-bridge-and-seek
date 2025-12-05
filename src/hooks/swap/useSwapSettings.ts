import { useState, useCallback, useMemo } from 'react';

export type SlippagePreset = 1 | 3 | 5 | 'custom';

export type SlippageWarning = {
  type: 'low' | 'high' | 'extreme' | null;
  message: string | null;
};

export type UseSwapSettingsResult = {
  slippage: number;
  slippagePreset: SlippagePreset;
  setSlippagePreset: (preset: SlippagePreset) => void;
  setCustomSlippage: (value: number) => void;
  warning: SlippageWarning;
  isCustom: boolean;
  calculateMinReceived: (amount: string) => string;
};

function getSlippageWarning(slippage: number): SlippageWarning {
  if (slippage < 1) {
    return {
      type: 'low',
      message: 'Your transaction may fail due to price movement',
    };
  }
  if (slippage > 50) {
    return {
      type: 'extreme',
      message: 'Extremely high slippage - you may lose significant funds',
    };
  }
  if (slippage > 6) {
    return {
      type: 'high',
      message: 'High slippage - you may receive less tokens than expected',
    };
  }
  return { type: null, message: null };
}

const PRESETS = [1, 3, 5] as const;

export function useSwapSettings(): UseSwapSettingsResult {
  const [slippage, setSlippage] = useState(5);
  const [isCustom, setIsCustom] = useState(false);

  // Derive preset from isCustom and slippage value
  const slippagePreset: SlippagePreset =
    isCustom || !PRESETS.includes(slippage as 1 | 3 | 5)
      ? 'custom'
      : (slippage as 1 | 3 | 5);

  const setSlippagePreset = useCallback((preset: SlippagePreset) => {
    if (preset === 'custom') {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      setSlippage(preset);
    }
  }, []);

  const setCustomSlippage = useCallback((value: number) => {
    setSlippage(value);
    setIsCustom(true);
  }, []);

  const warning = useMemo(() => getSlippageWarning(slippage), [slippage]);

  const calculateMinReceived = useCallback(
    (amount: string): string => {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) return '0';
      return (parsed * (1 - slippage / 100)).toFixed(6);
    },
    [slippage]
  );

  return {
    slippage,
    slippagePreset,
    setSlippagePreset,
    setCustomSlippage,
    warning,
    isCustom,
    calculateMinReceived,
  };
}

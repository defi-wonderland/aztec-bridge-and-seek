import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBaseSepoliaUniswapQuote } from './useBaseSepoliaUniswapQuote';

type Side = 'A' | 'B';
type Token = 'WETH' | 'USDC';

export type SwapPairState = {
  tokenA: Token;
  tokenB: Token;
  amountA: string;
  amountB: string;
};

export type UseSwapPairOptions = {
  initialTokenA?: Token;
  initialTokenB?: Token;
  convert?: (fromToken: Token, toToken: Token, value: number) => number;
  format?: (value: number) => string;
};

export type UseSwapPairResult = SwapPairState & {
  switchTokens: () => void;
  selectToken: (side: Side, token: Token) => void;
  handleAmountChangeFrom: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAmountChangeTo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  amountFrom: string;
  amountTo: string;
  isAutoQuoteActive: boolean;
  isAutoQuoteLoading: boolean;
  autoQuoteError: string | null;
};

/**
 * useSwapPair
 * Combined hook to manage token pair selection/order and bidirectional amount syncing.
 *
 * It mirrors the behavior in SwapForm:
 * - amounts are keyed by token identity (amountA = AZTC, amountB = WETH)
 * - switching tokens only flips the display order, not the meaning of amounts
 * - typing on "From" or "To" recalculates the other side using a conversion fn
 */
const isAutoQuotePair = (tokenA: Token, tokenB: Token) =>
  tokenA === 'WETH' && tokenB === 'USDC';

export function useSwapPair(options?: UseSwapPairOptions): UseSwapPairResult {
  const {
    initialTokenA = 'WETH',
    initialTokenB = 'USDC',
    convert = (from, to, value) => {
      if (from === 'WETH' && to === 'USDC') return value;
      if (from === 'USDC' && to === 'WETH') return value;
      return value;
    },
    format = (value) => value.toString(),
  } = options || {};

  const [state, setState] = useState<SwapPairState>({
    tokenA: initialTokenA,
    tokenB: initialTokenB,
    amountA: '',
    amountB: '',
  });

  const switchTokens = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tokenA: prev.tokenB,
      tokenB: prev.tokenA,
    }));
  }, []);

  const selectToken = useCallback((side: Side, token: Token) => {
    setState((prev) => {
      if (side === 'A') {
        if (token === prev.tokenA) return prev;
        if (token === prev.tokenB) {
          return { ...prev, tokenA: prev.tokenB, tokenB: prev.tokenA };
        }
        return { ...prev, tokenA: token };
      } else {
        if (token === prev.tokenB) return prev;
        if (token === prev.tokenA) {
          return { ...prev, tokenA: prev.tokenB, tokenB: prev.tokenA };
        }
        return { ...prev, tokenB: token };
      }
    });
  }, []);

  const handleAmountChangeFrom = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setState((prev) => {
        const autoQuoteActive = isAutoQuotePair(prev.tokenA, prev.tokenB);
        if (prev.tokenA === 'WETH') {
          const nextOther =
            value && !Number.isNaN(Number(value)) && !autoQuoteActive
              ? format(convert('WETH', 'USDC', Number(value)))
              : '';
          return { ...prev, amountA: value, amountB: nextOther };
        } else {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('USDC', 'WETH', Number(value)))
              : '';
          return { ...prev, amountB: value, amountA: nextOther };
        }
      });
    },
    [convert, format]
  );

  const handleAmountChangeTo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setState((prev) => {
        if (prev.tokenB === 'USDC') {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('USDC', 'WETH', Number(value)))
              : '';
          return { ...prev, amountB: value, amountA: nextOther };
        } else {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('WETH', 'USDC', Number(value)))
              : '';
          return { ...prev, amountA: value, amountB: nextOther };
        }
      });
    },
    [convert, format]
  );

  const amountFrom = useMemo(() => {
    return state.tokenA === 'WETH' ? state.amountA : state.amountB;
  }, [state.tokenA, state.amountA, state.amountB]);

  const amountTo = useMemo(() => {
    return state.tokenB === 'USDC' ? state.amountB : state.amountA;
  }, [state.tokenB, state.amountA, state.amountB]);

  const shouldAutoQuote = isAutoQuotePair(state.tokenA, state.tokenB);
  const hasFromAmount =
    amountFrom.trim() !== '' &&
    !Number.isNaN(Number(amountFrom)) &&
    Number(amountFrom) > 0;

  const {
    amountOut: quotedAmount,
    isLoading: isQuoteLoading,
    error: autoQuoteError,
    hasQuote,
  } = useBaseSepoliaUniswapQuote({
    amountIn: shouldAutoQuote && hasFromAmount ? amountFrom : undefined,
    enabled: shouldAutoQuote && hasFromAmount,
  });

  useEffect(() => {
    if (!shouldAutoQuote) {
      return;
    }

    setState((prev) => {
      if (!isAutoQuotePair(prev.tokenA, prev.tokenB)) {
        return prev;
      }

      if (!hasFromAmount || isQuoteLoading) {
        if (prev.tokenB === 'USDC' && prev.amountB !== '') {
          return { ...prev, amountB: '' };
        }
        return prev;
      }

      if (hasQuote && prev.tokenB === 'USDC' && prev.amountB !== quotedAmount) {
        return { ...prev, amountB: quotedAmount };
      }

      return prev;
    });
  }, [shouldAutoQuote, hasFromAmount, isQuoteLoading, hasQuote, quotedAmount]);

  return {
    ...state,
    switchTokens,
    selectToken,
    handleAmountChangeFrom,
    handleAmountChangeTo,
    amountFrom,
    amountTo,
    isAutoQuoteActive: shouldAutoQuote,
    isAutoQuoteLoading: isQuoteLoading,
    autoQuoteError,
  };
}

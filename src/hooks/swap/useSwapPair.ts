import { useCallback, useMemo, useState } from 'react';

type Side = 'A' | 'B';
type Token = 'AZTC' | 'WETH';

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
export function useSwapPair(options?: UseSwapPairOptions): UseSwapPairResult {
  const {
    initialTokenA = 'AZTC',
    initialTokenB = 'WETH',
    convert = (from, to, value) => {
      if (from === 'AZTC' && to === 'WETH') return value / 4;
      if (from === 'WETH' && to === 'AZTC') return value * 4;
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
        if (prev.tokenA === 'AZTC') {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('AZTC', 'WETH', Number(value)))
              : '';
          return { ...prev, amountA: value, amountB: nextOther };
        } else {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('WETH', 'AZTC', Number(value)))
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
        if (prev.tokenB === 'WETH') {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('WETH', 'AZTC', Number(value)))
              : '';
          return { ...prev, amountB: value, amountA: nextOther };
        } else {
          const nextOther =
            value && !Number.isNaN(Number(value))
              ? format(convert('AZTC', 'WETH', Number(value)))
              : '';
          return { ...prev, amountA: value, amountB: nextOther };
        }
      });
    },
    [convert, format]
  );

  const amountFrom = useMemo(() => {
    return state.tokenA === 'AZTC' ? state.amountA : state.amountB;
  }, [state.tokenA, state.amountA, state.amountB]);

  const amountTo = useMemo(() => {
    return state.tokenB === 'WETH' ? state.amountB : state.amountA;
  }, [state.tokenB, state.amountA, state.amountB]);

  return {
    ...state,
    switchTokens,
    selectToken,
    handleAmountChangeFrom,
    handleAmountChangeTo,
    amountFrom,
    amountTo,
  };
}

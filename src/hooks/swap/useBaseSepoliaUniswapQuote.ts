import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig as useWagmiConfig } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { formatUnits, parseUnits } from 'viem';
import { useConfig } from '../context/useConfig';
import uniswapRouterAbi from '../../abi/uniswapRouter.json';

const BASE_SEPOLIA_UNISWAP_ROUTER_ADDRESS =
  '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602';

export type UseBaseSepoliaUniswapQuoteArgs = {
  /**
   * Human-readable input amount (e.g. "0.1")
   */
  amountIn?: string;
  /**
   * Number of decimals for the input token (defaults to 18 for WETH)
   */
  fromDecimals?: number;
  /**
   * Number of decimals for the output token (defaults to 6 for USDC)
   */
  toDecimals?: number;
  /**
   * Override swap path if needed
   */
  path?: readonly `0x${string}`[];
  /**
   * Disable automatic quoting (useful when wallets are disconnected)
   */
  enabled?: boolean;
};

export type UseBaseSepoliaUniswapQuoteResult = {
  amountOut: string;
  rawAmounts: bigint[];
  isLoading: boolean;
  error: string | null;
  refetch: (overrideAmountIn?: string) => Promise<void>;
  path: readonly `0x${string}`[];
  hasQuote: boolean;
};

/**
 * Fetches Uniswap V2 pair quotes on Base Sepolia using getAmountsOut.
 * It watches the provided input amount and automatically refreshes the quote.
 */
export const useBaseSepoliaUniswapQuote = (
  args?: UseBaseSepoliaUniswapQuoteArgs
): UseBaseSepoliaUniswapQuoteResult => {
  const { currentConfig } = useConfig();
  const bridgeConfig = currentConfig.bridge;

  // Build default swap path from bridge config
  const defaultSwapPath = useMemo(() => {
    if (!bridgeConfig) return [] as readonly `0x${string}`[];
    return [
      bridgeConfig.evmWeth as `0x${string}`,
      bridgeConfig.evmUsdc as `0x${string}`,
    ] as const;
  }, [bridgeConfig]);

  const {
    amountIn,
    fromDecimals = 18,
    toDecimals = 6,
    path = defaultSwapPath,
    enabled = true,
  } = args || {};

  const wagmiConfig = useWagmiConfig();
  const [amountOut, setAmountOut] = useState('');
  const [rawAmounts, setRawAmounts] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQuote, setHasQuote] = useState(false);

  const resolvedPath = useMemo(
    () => (path.length ? path : defaultSwapPath),
    [path, defaultSwapPath]
  );

  const resetQuote = useCallback(() => {
    setAmountOut('');
    setRawAmounts([]);
    setHasQuote(false);
  }, []);

  const fetchQuote = useCallback(
    async (overrideAmountIn?: string) => {
      if (!enabled || !bridgeConfig) {
        resetQuote();
        return;
      }

      const effectiveAmountIn = (overrideAmountIn ?? amountIn)?.trim();

      if (!effectiveAmountIn || Number(effectiveAmountIn) <= 0) {
        resetQuote();
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const parsedAmountIn = parseUnits(effectiveAmountIn, fromDecimals);

        const amounts = (await readContract(wagmiConfig, {
          address: BASE_SEPOLIA_UNISWAP_ROUTER_ADDRESS,
          abi: uniswapRouterAbi,
          functionName: 'getAmountsOut',
          args: [parsedAmountIn, resolvedPath],
          chainId: bridgeConfig.evmChainId,
        })) as bigint[];

        setRawAmounts(amounts);

        if (!amounts.length) {
          setAmountOut('');
          setHasQuote(false);
          return;
        }

        const latestAmount = amounts[amounts.length - 1];
        setAmountOut(formatUnits(latestAmount, toDecimals));
        setHasQuote(true);
      } catch (err) {
        console.error('Failed to fetch Base Sepolia Uniswap quote:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to fetch Base Sepolia quote';
        setError(message);
        setHasQuote(false);
      } finally {
        setIsLoading(false);
      }
    },
    [
      enabled,
      amountIn,
      fromDecimals,
      resolvedPath,
      toDecimals,
      wagmiConfig,
      resetQuote,
      bridgeConfig,
    ]
  );

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return {
    amountOut,
    rawAmounts,
    isLoading,
    error,
    refetch: fetchQuote,
    path: resolvedPath,
    hasQuote,
  };
};

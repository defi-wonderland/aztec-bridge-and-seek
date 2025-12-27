import { useState, useEffect, useCallback } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { useConfig } from './context/useConfig';
import { AztecAddress } from '@aztec/aztec.js/addresses';

export const useWethBalance = () => {
  const { connectedAccount: aztecWallet, tokenService } = useAztecWallet();
  const { currentConfig } = useConfig();
  const bridgeConfig = currentConfig.bridge;
  const [wethBalance, setWethBalance] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!tokenService || !aztecWallet || !bridgeConfig) {
      setWethBalance(null);
      setUsdcBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch USDC private balance
      const usdcPrivateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(bridgeConfig.aztecUsdc),
        aztecWallet.getAddress()
      );
      setUsdcBalance(usdcPrivateBalance);

      // Fetch WETH private balance from the Wonder token
      const wethPrivateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(bridgeConfig.aztecWeth),
        aztecWallet.getAddress()
      );
      console.log('wethPrivateBalance', wethPrivateBalance);
      setWethBalance(wethPrivateBalance);
    } catch (err) {
      console.error('Failed to fetch token balances:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch token balances'
      );
    } finally {
      setIsLoading(false);
    }
  }, [tokenService, aztecWallet, bridgeConfig]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    wethBalance,
    usdcBalance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
};

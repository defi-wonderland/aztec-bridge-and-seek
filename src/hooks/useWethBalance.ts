import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { BRIDGE_CONFIG } from '../config/networks/devnet';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AZTEC_BRIDGE_SWAP_TOKEN } from '../config/bridgeConstants';

export const useWethBalance = () => {
  const { connectedAccount: aztecWallet, tokenService } = useAztecWallet();
  const [wethBalance, setWethBalance] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!tokenService || !aztecWallet) {
      setWethBalance(null);
      setUsdcBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch USDC private balance (BRIDGE_CONFIG.aztecWETH is actually USDC)
      const usdcPrivateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH),
        aztecWallet.getAddress(),
        false
      );
      setUsdcBalance(usdcPrivateBalance);

      // Fetch WETH private balance (AZTEC_BRIDGE_SWAP_TOKEN is actually WETH)
      const wethPrivateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(AZTEC_BRIDGE_SWAP_TOKEN),
        aztecWallet.getAddress(),
        false
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
  };

  useEffect(() => {
    fetchBalance();
  }, [aztecWallet, tokenService]);

  return {
    wethBalance,
    usdcBalance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
};

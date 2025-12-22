import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { BRIDGE_CONFIG, DEVNET_CONFIG } from '../config/networks/devnet';
import { AztecAddress } from '@aztec/aztec.js/addresses';

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
      // Fetch USDC private balance (BRIDGE_CONFIG.aztecWETH)
      const usdcPrivateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH),
        aztecWallet.getAddress()
      );
      setUsdcBalance(usdcPrivateBalance);

      // Fetch WETH private balance from the Wonder token (Dripper token)
      const wethPrivateBalance = await tokenService.getPrivateBalance(
        DEVNET_CONFIG.tokenContractAddress,
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

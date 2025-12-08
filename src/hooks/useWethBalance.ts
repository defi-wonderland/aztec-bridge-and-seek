import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { BRIDGE_CONFIG } from '../config/networks/devnet';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AZTEC_BRIDGE_SWAP_TOKEN } from '../config/bridgeConstants';

export const useWethBalance = () => {
  const { connectedAccount: aztecWallet, tokenService } = useAztecWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!tokenService || !aztecWallet) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch WETH private balance
      const privateBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(BRIDGE_CONFIG.aztecWETH),
        aztecWallet.getAddress(),
        false
      );
      setBalance(privateBalance);
      // // Fetch USDC private balance
      const usdcBalance = await tokenService.getPrivateBalance(
        AztecAddress.fromString(AZTEC_BRIDGE_SWAP_TOKEN),
        aztecWallet.getAddress(),
        true
      );
      setUsdcBalance(usdcBalance);
    } catch (err) {
      console.error('Failed to fetch WETH balance:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch WETH balance'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [aztecWallet, tokenService]);

  return {
    balance,
    usdcBalance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
};

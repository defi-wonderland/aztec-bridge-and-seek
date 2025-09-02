import { useEffect, useState } from 'react';
import { useBalance } from 'wagmi';
import { useEVMWallet } from './context/useEVMWallet';
import { BASE_SEPOLIA_WETH } from '../config';
import type { Address } from 'viem';

export const useEvmWethBalance = () => {
  const { account } = useEVMWallet();
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: wethBalanceData, isLoading: isWethLoading, refetch } = useBalance({
    address: account?.address,
    token: BASE_SEPOLIA_WETH as Address,
    enabled: !!account?.address,
  });

  useEffect(() => {
    if (wethBalanceData) {
      setBalance(wethBalanceData.value);
      setError(null);
    } else if (!isWethLoading && account?.address) {
      setBalance(0n);
    }
  }, [wethBalanceData, isWethLoading, account?.address]);

  useEffect(() => {
    setIsLoading(isWethLoading);
  }, [isWethLoading]);

  return {
    balance,
    isLoading,
    error,
    refetch,
  };
};
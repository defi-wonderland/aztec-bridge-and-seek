import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { useAztecWallet } from '../hooks';
import { getEnv } from '../config';

interface TokenBalance {
  private: bigint;
  public: bigint;
}

export interface TokenContextType {
  // Balance state
  tokenBalance: TokenBalance | null;
  isBalanceLoading: boolean;
  balanceError: string | null;
  currentTokenAddress: string;

  // Actions
  setTokenAddress: (address: string) => void;
  clearTokenAddress: () => void;
  resetToDefaultToken: () => void;
  refreshBalance: () => Promise<void>;
  reset: () => void;

  // Computed values
  formattedBalances: {
    private: string;
    public: string;
    total: string;
  } | null;
  isDefaultToken: boolean;
}

export const TokenContext = createContext<TokenContextType | undefined>(
  undefined
);

interface TokenProviderProps {
  children: ReactNode;
}

export const TokenProvider: React.FC<TokenProviderProps> = ({ children }) => {
  const { tokenService, connectedAccount } = useAztecWallet();
  const config = getEnv();

  // Balance state
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [currentTokenAddress, setCurrentTokenAddress] = useState<string>(
    config.TOKEN_CONTRACT_ADDRESS || ''
  );

  // Auto-fetch balance when token address changes or when account connects
  useEffect(() => {
    if (currentTokenAddress && connectedAccount && tokenService) {
      fetchTokenBalance(currentTokenAddress);
    }
  }, [currentTokenAddress, connectedAccount, tokenService]);

  // Ensure default token address is set when component mounts
  useEffect(() => {
    if (!currentTokenAddress && config.TOKEN_CONTRACT_ADDRESS) {
      setCurrentTokenAddress(config.TOKEN_CONTRACT_ADDRESS);
    }
  }, [currentTokenAddress, config.TOKEN_CONTRACT_ADDRESS]);

  // Reset state when wallet is disconnected
  useEffect(() => {
    if (!connectedAccount) {
      reset();
    }
  }, [connectedAccount]);

  // Balance methods
  const fetchTokenBalance = async (tokenAddress: string) => {
    if (!tokenAddress || !tokenService || !connectedAccount) {
      setTokenBalance(null);
      return;
    }

    setIsBalanceLoading(true);
    setBalanceError(null);

    try {
      const ownerAddress = connectedAccount.getAddress().toString();

      // Make calls sequential to avoid PXE concurrency issues
      const privateBalance = await tokenService.getPrivateBalance(
        tokenAddress,
        ownerAddress
      );
      const publicBalance = await tokenService.getPublicBalance(
        tokenAddress,
        ownerAddress
      );

      setTokenBalance({
        private: privateBalance,
        public: publicBalance,
      });
    } catch (err) {
      setBalanceError(
        err instanceof Error ? err.message : 'Failed to fetch balance'
      );
      setTokenBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (currentTokenAddress) {
      await fetchTokenBalance(currentTokenAddress);
    }
  };

  const setTokenAddress = (address: string) => {
    setCurrentTokenAddress(address);
    // Balance will be fetched automatically via useEffect
  };

  const clearTokenAddress = () => {
    setCurrentTokenAddress('');
    setTokenBalance(null);
  };

  const resetToDefaultToken = () => {
    setCurrentTokenAddress(config.TOKEN_CONTRACT_ADDRESS || '');
    setTokenBalance(null); // Clear balance when resetting token
  };

  const reset = () => {
    setTokenBalance(null);
    setIsBalanceLoading(false);
    setBalanceError(null);
    // Don't clear currentTokenAddress - keep the default token address
  };

  // Format balance values
  const formatBalance = (balance: bigint): string => {
    return balance.toString();
  };

  // Compute formatted balances
  const formattedBalances = tokenBalance
    ? {
        private: formatBalance(tokenBalance.private),
        public: formatBalance(tokenBalance.public),
        total: formatBalance(tokenBalance.private + tokenBalance.public),
      }
    : null;

  const isDefaultToken = currentTokenAddress === config.TOKEN_CONTRACT_ADDRESS;

  const contextValue: TokenContextType = {
    tokenBalance,
    isBalanceLoading,
    balanceError,
    currentTokenAddress,
    setTokenAddress,
    clearTokenAddress,
    resetToDefaultToken,
    refreshBalance,
    reset,
    formattedBalances,
    isDefaultToken,
  };

  return (
    <TokenContext.Provider value={contextValue}>
      {children}
    </TokenContext.Provider>
  );
};

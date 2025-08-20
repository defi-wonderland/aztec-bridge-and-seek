import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, cookieStorage, createStorage, WagmiProvider, useAccount, useBalance, useChainId, useConnect, useDisconnect } from 'wagmi';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { sepolia } from 'wagmi/chains';
import { EVM_NETWORKS } from '../config';
import { EVMAccount, EVMBalance, EVMNetworkState } from '../types';

// Create React Query client
const queryClient = new QueryClient();


const getWallets = () => {
  return [injectedWallet];
};

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: getWallets(),
    },
  ],
  {
    appName: 'Web3 React boilerplate',
    projectId: 'PROJECT_ID', // TODO: Add to env
  },
);

export const config = createConfig({
  chains: [sepolia],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [sepolia.id]: http(),
  },
  batch: { multicall: true },
  connectors,
});

export interface EVMWalletContextType {
  // Account state
  account: EVMAccount | null;

  // Network state
  network: EVMNetworkState;

  // Balance state
  balance: EVMBalance | null;
  isBalanceLoading: boolean;

  // Wallet actions
  connect: () => void;
  disconnect: () => void;

  // Utility
  isSupported: boolean;
}

export const EVMWalletContext = createContext<EVMWalletContextType | undefined>(undefined);

interface EVMWalletProviderProps {
  children: ReactNode;
}

// Inner provider component that uses Wagmi hooks
const EVMWalletInnerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isConnected, isConnecting, isReconnecting, isDisconnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
  });

  const [balance, setBalance] = useState<EVMBalance | null>(null);

  // Update balance when balance data changes
  useEffect(() => {
    if (balanceData && address) {
      setBalance({
        address,
        balance: balanceData.value,
        formatted: balanceData.formatted,
        symbol: balanceData.symbol,
        decimals: balanceData.decimals,
      });
    } else {
      setBalance(null);
    }
  }, [balanceData, address]);

  // Create account object
  const account: EVMAccount | null = address
    ? {
        address,
        isConnected,
        isConnecting,
        isReconnecting,
        isDisconnected,
      }
    : null;

  // Create network state
  const network: EVMNetworkState = {
    chainId,
    isSupported: EVM_NETWORKS.some((n) => n.id === chainId),
    isWrongNetwork: false, // TODO: Implement wrong network detection
  };

  // Wallet actions
  const handleConnect = () => {
    if (connectors[0]) {
      connect({ connector: connectors[0] });
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const contextValue: EVMWalletContextType = {
    account,
    network,
    balance,
    isBalanceLoading,
    connect: handleConnect,
    disconnect: handleDisconnect,
    isSupported: network.isSupported,
  };

  return (
    <EVMWalletContext.Provider value={contextValue}>
      {children}
    </EVMWalletContext.Provider>
  );
};

export const EVMWalletProvider: React.FC<EVMWalletProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <EVMWalletInnerProvider>{children}</EVMWalletInnerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};


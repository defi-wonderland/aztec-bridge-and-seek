import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ethers } from 'ethers';

interface EvmWalletContextType {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBaseSepolia: () => Promise<void>;
}

export const EvmWalletContext = createContext<EvmWalletContextType | undefined>(
  undefined
);

export const EvmWalletProvider: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const isConnected = !!address;

  const BASE_SEPOLIA_CHAIN_ID = 84532;
  const BASE_SEPOLIA_PARAMS = {
    chainId: ethers.toBeHex(BASE_SEPOLIA_CHAIN_ID),
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  } as const;

  const getInjected = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (globalThis as any).ethereum;
    return eth ? new ethers.BrowserProvider(eth) : null;
  }, []);

  const refresh = useCallback(async () => {
    const prov = getInjected();
    setProvider(prov);
    if (!prov) {
      setAddress(null);
      setChainId(null);
      return;
    }
    try {
      const net = await prov.getNetwork();
      setChainId(Number(net.chainId));
      // request existing accounts without prompting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts: string[] = await (prov as any).send('eth_accounts', []);
      setAddress(accounts?.[0] ?? null);
    } catch {
      setAddress(null);
      setChainId(null);
    }
  }, [getInjected]);

  const switchToBaseSepoliaInternal = useCallback(
    async (prov: ethers.BrowserProvider) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc: any = prov;
      try {
        await rpc.send('wallet_switchEthereumChain', [
          { chainId: BASE_SEPOLIA_PARAMS.chainId },
        ]);
      } catch (err: any) {
        if (err?.code === 4902) {
          await rpc.send('wallet_addEthereumChain', [BASE_SEPOLIA_PARAMS]);
        } else {
          throw err;
        }
      }
      const net = await prov.getNetwork();
      setChainId(Number(net.chainId));
    },
    []
  );

  const switchToBaseSepolia = useCallback(async () => {
    const prov = provider ?? getInjected();
    if (!prov) throw new Error('No EVM wallet found');
    await switchToBaseSepoliaInternal(prov);
  }, [provider, getInjected, switchToBaseSepoliaInternal]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (globalThis as any).ethereum;
    if (!eth) return;
    const handleAccountsChanged = (accs: string[]) =>
      setAddress(accs?.[0] ?? null);
    const handleChainChanged = () => refresh();
    eth.on?.('accountsChanged', handleAccountsChanged);
    eth.on?.('chainChanged', handleChainChanged);
    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged);
      eth.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const prov = getInjected();
    if (!prov) throw new Error('No EVM wallet found');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts: string[] = await (prov as any).send(
      'eth_requestAccounts',
      []
    );
    setAddress(accounts?.[0] ?? null);
    // Force switch to Base Sepolia upon connect
    await switchToBaseSepoliaInternal(prov);
    const net = await prov.getNetwork();
    setChainId(Number(net.chainId));
    setProvider(prov);
  }, [getInjected, switchToBaseSepoliaInternal]);

  const disconnect = useCallback(() => {
    // There is no standard programmatic disconnect for injected wallets.
    setAddress(null);
  }, []);

  // If connected and on wrong chain, force switch silently in background
  useEffect(() => {
    const enforce = async () => {
      if (
        provider &&
        isConnected &&
        chainId !== null &&
        chainId !== BASE_SEPOLIA_CHAIN_ID
      ) {
        try {
          await switchToBaseSepoliaInternal(provider);
        } catch {
          // ignore, user may reject; UI will still show wrong network until they approve
        }
      }
    };
    enforce();
  }, [provider, isConnected, chainId, switchToBaseSepoliaInternal]);

  const value = useMemo<EvmWalletContextType>(
    () => ({
      isConnected,
      address,
      chainId,
      provider,
      connect,
      disconnect,
      switchToBaseSepolia,
    }),
    [
      isConnected,
      address,
      chainId,
      provider,
      connect,
      disconnect,
      switchToBaseSepolia,
    ]
  );

  return (
    <EvmWalletContext.Provider value={value}>
      {children}
    </EvmWalletContext.Provider>
  );
};

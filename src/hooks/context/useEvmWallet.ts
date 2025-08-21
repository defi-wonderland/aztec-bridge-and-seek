import { useContext } from 'react';
import { EvmWalletContext } from '../../providers/EvmWalletProvider';

export const useEvmWallet = () => {
  const ctx = useContext(EvmWalletContext);
  if (!ctx) throw new Error('useEvmWallet must be used within EvmWalletProvider');
  return ctx;
};



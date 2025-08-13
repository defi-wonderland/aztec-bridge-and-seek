import { useContext } from 'react';
import { AztecWalletContext } from '../../providers/AztecWalletProvider';

/**
 * Hook for accessing Aztec wallet context
 */
export const useAztecWallet = () => {
  const context = useContext(AztecWalletContext);
  if (context === undefined) {
    throw new Error('useAztecWallet must be used within an AztecWalletProvider');
  }
  return context;
};

import { useContext } from "react";
import { EVMWalletContext, EVMWalletContextType } from '../../providers/AzGuardWalletProvider';

export const useEVMWallet = (): EVMWalletContextType => {
  const context = useContext(EVMWalletContext);
  if (context === undefined) {
    throw new Error('useEVMWallet must be used within an EVMWalletProvider');
  }
  return context;
};
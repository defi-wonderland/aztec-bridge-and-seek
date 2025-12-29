import React from 'react';
import { SwapForm } from './SwapForm';
import { useAztecWallet } from '../../hooks/context/useAztecWallet';
import { useTabContracts } from '../../hooks';
import { ContractLoadingState, ContractErrorState } from '../../components';

export const SwapCard: React.FC = () => {
  const { isInitialized } = useAztecWallet();
  const { isLoading, hasErrors, retry } = useTabContracts(
    'swap',
    isInitialized
  );

  if (isLoading) {
    return (
      <ContractLoadingState className="swap-card" icon="🔄" title="Swap" />
    );
  }

  if (hasErrors) {
    return (
      <ContractErrorState
        className="swap-card"
        icon="🔄"
        title="Swap"
        onRetry={retry}
      />
    );
  }

  return (
    <div className="settings-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🔄</span>
        </div>
        <div>
          <h3>Cross-Chain Swap</h3>
          <p>
            Send tokens from Aztec to Base Sepolia, swap there, then receive
            them back on Aztec.
          </p>
        </div>
      </div>

      <SwapForm />
    </div>
  );
};

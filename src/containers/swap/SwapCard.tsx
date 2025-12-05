import React from 'react';
import { SwapForm } from './SwapForm';

export const SwapCard: React.FC = () => {
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

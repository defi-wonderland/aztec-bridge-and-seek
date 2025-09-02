import React, { useState } from 'react';
import { BridgeForm } from './BridgeForm';
import { BridgeDirection } from '../types';

export const BridgeCard: React.FC = () => {
  const [activeDirection, setActiveDirection] = useState<BridgeDirection>('out');

  const handleToggle = () => {
    setActiveDirection(activeDirection === 'out' ? 'in' : 'out');
  };

  return (
    <div className="bridge-card">
      {/* Sub-tabs for Bridge In/Out */}
      <div className="bridge-subtabs">
        <div className="bridge-subtabs-list" onClick={handleToggle}>
          <div className={`bridge-subtab ${activeDirection === 'out' ? 'active' : ''}`}>
            <span className="bridge-subtab-icon">🌉</span>
            Bridge Out
          </div>
          <div className={`bridge-subtab ${activeDirection === 'in' ? 'active' : ''}`}>
            <span className="bridge-subtab-icon">🌈</span>
            Bridge In
          </div>
        </div>
      </div>

      {/* Bridge Form */}
      <div className="bridge-content">
        <BridgeForm direction={activeDirection} />
      </div>
    </div>
  );
};
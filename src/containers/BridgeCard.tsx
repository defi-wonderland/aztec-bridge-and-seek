import React, { useState, useMemo } from 'react';
import { useConfig } from 'wagmi';
import { Fr } from '@aztec/aztec.js/fields';
import { BridgeForm } from './BridgeForm';
import { BridgeDirection } from '../types';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { EVMBridgeService } from '../services/evm/features/EVMBridgeService';
import { useError } from '../providers/ErrorProvider';

export const BridgeCard: React.FC = () => {
  const [activeDirection, setActiveDirection] = useState<BridgeDirection>('out');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const wagmiConfig = useConfig();
  const { account: evmAccount } = useEVMWallet();
  const { wallet: aztecWallet, bridgeService: aztecBridgeService } = useAztecWallet();
  const { addMessage } = useError();

  // Create bridge service instance for testing
  const bridgeService = useMemo(() => {
    if (!aztecWallet || !aztecBridgeService) {
      return null;
    }
    try {
      return new EVMBridgeService(wagmiConfig, evmAccount, aztecWallet, aztecBridgeService);
    } catch (error) {
      console.error('Failed to create EVMBridgeService:', error);
      return null;
    }
  }, [wagmiConfig, evmAccount, aztecWallet, aztecBridgeService]);

  const handleToggle = () => {
    setActiveDirection(activeDirection === 'out' ? 'in' : 'out');
  };

  const handleLogOrderStatus = async () => {
    if (!aztecBridgeService || !aztecWallet) {
      addMessage({
        message: 'Bridge service not available. Please connect wallets.',
        type: 'error',
        source: 'bridge',
      });
      return;
    }

    if (!orderIdInput.trim()) {
      addMessage({
        message: 'Please enter an order ID',
        type: 'error',
        source: 'bridge',
      });
      return;
    }

    setIsLogging(true);
    try {
      const gateway = await aztecBridgeService.getGatewayContract(aztecWallet);
      if (!gateway) {
        throw new Error('Gateway contract not found');
      }

      // Convert orderId string to Fr
      const orderId = Fr.fromString(orderIdInput.trim());
      
      console.log('=== Logging Order Status ===');
      console.log('Order ID:', orderIdInput.trim());
      
      const status = await gateway.methods
        .get_order_status(orderId)
        .simulate({
          from: aztecWallet.connectedAccount?.getAddress(),
          skipTxValidation: true,
        });

      console.log('Order Status:', status.toString());
      console.log('Order Status (number):', Number(status));
      console.log('===========================');

      addMessage({
        message: `Order status: ${status.toString()} (${Number(status)})`,
        type: 'info',
        source: 'bridge',
      });
    } catch (error) {
      console.error('Log order status error:', error);
      addMessage({
        message: `Failed to log order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        source: 'bridge',
      });
    } finally {
      setIsLogging(false);
    }
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

      {/* Log Order Status */}
      <div style={{ marginTop: '20px', padding: '10px', borderTop: '1px solid #ccc' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="Enter order ID (hex string)"
            disabled={isLogging || !aztecBridgeService || !aztecWallet}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '14px',
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLogging) {
                handleLogOrderStatus();
              }
            }}
          />
          <button
            onClick={handleLogOrderStatus}
            disabled={isLogging || !aztecBridgeService || !aztecWallet}
            style={{
              padding: '10px 20px',
              backgroundColor: isLogging || !aztecBridgeService || !aztecWallet ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLogging || !aztecBridgeService || !aztecWallet ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            {isLogging ? 'Logging...' : '📋 Log Order Status'}
          </button>
        </div>
      </div>
    </div>
  );
};
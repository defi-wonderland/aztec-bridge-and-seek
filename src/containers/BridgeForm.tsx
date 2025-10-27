import React, { useState } from 'react';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { useWethBalance } from '../hooks/useWethBalance';
import { useEvmWethBalance } from '../hooks/useEvmWethBalance';
import { useBridgeOut } from '../hooks/useBridgeOut';
import { useBridgeIn } from '../hooks/useBridgeIn';
import { formatUnits } from 'viem';
import { BRIDGE_CONFIG } from '../config/networks/testnet';
import { BridgeDirection } from '../types';

interface BridgeFormProps {
  direction: BridgeDirection;
}

export const BridgeForm: React.FC<BridgeFormProps> = ({ direction }) => {
  const { account: evmAccount, connect: connectEVM, isSupported } = useEVMWallet();
  const { connectedAccount: aztecWallet, connectTestAccount } = useAztecWallet();
  
  // Aztec WETH balance (for bridge out)
  const { balance: aztecWethBalance, isLoading: isLoadingAztecWeth, refetch: refetchAztecWeth } = useWethBalance();
  
  // EVM WETH balance (for bridge in)
  const { balance: evmWethBalance, isLoading: isLoadingEvmWeth, refetch: refetchEvmWeth } = useEvmWethBalance();
  
  const [amount, setAmount] = useState('');
  
  const { bridgeOut, isBridging: isBridgingOut, error: bridgeOutError, orderStatus: bridgeOutStatus, clearError: clearBridgeOutError } = useBridgeOut({
    onSuccess: async () => {
      setAmount('');
      await refetchAztecWeth();
    }
  });

  const { bridgeIn, isBridging: isBridgingIn, error: bridgeInError, orderStatus: bridgeInStatus, clearError: clearBridgeInError } = useBridgeIn({
    onSuccess: async () => {
      setAmount('');
      await refetchEvmWeth();
    }
  });

  // Use the appropriate state based on direction
  const isBridging = direction === 'out' ? isBridgingOut : isBridgingIn;
  const error = direction === 'out' ? bridgeOutError : bridgeInError;
  const orderStatus = direction === 'out' ? bridgeOutStatus : bridgeInStatus;
  const clearError = direction === 'out' ? clearBridgeOutError : clearBridgeInError;
  
  const sourceBalance = direction === 'out' ? (aztecWethBalance ?? 0n) : evmWethBalance;
  const isLoadingBalance = direction === 'out' ? isLoadingAztecWeth : isLoadingEvmWeth;
  const formattedBalance = formatUnits(sourceBalance, 18);
  
  // Configuration based on direction
  const config = {
    out: {
      title: 'Bridge Out',
      subtitle: 'Transfer WETH from Aztec to Base Sepolia',
      fromNetwork: 'Aztec Testnet',
      toNetwork: 'Base Sepolia',
      fromAddress: aztecWallet?.getAddress().toString(),
      toAddress: evmAccount?.address,
      balanceLabel: 'Available Private Balance',
      buttonText: 'Bridge to Base Sepolia',
      tokenAddress: BRIDGE_CONFIG.aztecWETH,
    },
    in: {
      title: 'Bridge In',
      subtitle: 'Transfer WETH from Base Sepolia to Aztec',
      fromNetwork: 'Base Sepolia',
      toNetwork: 'Aztec Testnet',
      fromAddress: evmAccount?.address,
      toAddress: aztecWallet?.getAddress().toString(),
      balanceLabel: 'Available WETH Balance',
      buttonText: 'Bridge to Aztec',
      tokenAddress: BRIDGE_CONFIG.baseSepoliaWETH,
    },
  };

  const currentConfig = config[direction];
  
  // Computed variables for addresses
  const truncatedFromAddress = currentConfig.fromAddress ? 
    `${currentConfig.fromAddress.slice(0, 8)}...${currentConfig.fromAddress.slice(-6)}` : '';
  const truncatedToAddress = currentConfig.toAddress ? 
    `${currentConfig.toAddress.slice(0, 8)}...${currentConfig.toAddress.slice(-6)}` : '';
  const truncatedWethAddress = `${currentConfig.tokenAddress.slice(0, 6)}...${currentConfig.tokenAddress.slice(-4)}`;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      clearError();
    }
  };

  const handleBridge = async () => {
    if (direction === 'out') {
      await bridgeOut(amount, sourceBalance);
    } else {
      await bridgeIn(amount, sourceBalance);
    }
  };

  const handleConnectAztec = async () => {
    try {
      await connectTestAccount(0); // Connect to test account index 0
    } catch (error) {
      console.error('Failed to connect Aztec wallet:', error);
    }
  };

  const isConnected = evmAccount?.isConnected && aztecWallet;
  const canBridge = isConnected && amount && !isBridging && parseFloat(amount) > 0;

  return (
    <div className="bridge-form">
      <div className="bridge-header">
        <h2 className="bridge-title">
          <span className="bridge-icon">{direction === 'out' ? '🌉' : '🌈'}</span>
          {currentConfig.title}
        </h2>
        <p className="bridge-subtitle">{currentConfig.subtitle}</p>
      </div>

      <div className="bridge-route">
        <div className="route-endpoint">
          <span className="route-label">From</span>
          <div className="route-network">{currentConfig.fromNetwork}</div>
          {currentConfig.fromAddress ? (
            <div className="route-address" title={currentConfig.fromAddress}>
              {truncatedFromAddress}
            </div>
          ) : (
            // Show connect button for source wallet if not connected
            direction === 'out' ? (
              <button 
                className="connect-aztec-button"
                onClick={handleConnectAztec}
              >
                Connect Aztec Wallet
              </button>
            ) : (
              <button 
                className="connect-evm-button"
                onClick={connectEVM}
                disabled={!isSupported}
              >
                Connect EVM Wallet
              </button>
            )
          )}
        </div>
        <div className="route-arrow">→</div>
        <div className="route-endpoint">
          <span className="route-label">To</span>
          <div className="route-network">{currentConfig.toNetwork}</div>
          {currentConfig.toAddress ? (
            <div className="route-address" title={currentConfig.toAddress}>
              {truncatedToAddress}
            </div>
          ) : (
            // Show connect button for destination wallet if not connected
            direction === 'out' ? (
              <button 
                className="connect-evm-button"
                onClick={connectEVM}
                disabled={!isSupported}
              >
                Connect EVM Wallet
              </button>
            ) : (
              <button 
                className="connect-aztec-button"
                onClick={handleConnectAztec}
              >
                Connect Aztec Wallet
              </button>
            )
          )}
        </div>
      </div>

      <div className="token-section">
        <div className="token-info">
          <span className="token-label">Token</span>
          <div className="token-details">
            <div className="token-name">WETH (Wrapped Ether)</div>
            <div className="token-address" title={currentConfig.tokenAddress}>
              {truncatedWethAddress}
            </div>
          </div>
        </div>
      </div>

      <div className="amount-section">
        <label className="amount-label" htmlFor="bridge-amount">
          Amount to Bridge
        </label>
        <input
          id="bridge-amount"
          type="text"
          className="amount-input"
          placeholder="0.0"
          value={amount}
          onChange={handleAmountChange}
          disabled={!isConnected || isBridging}
        />
        {isConnected && (
          <div className="balance-info">
            <div className="balance-label">{currentConfig.balanceLabel}</div>
            {!isLoadingBalance && 
              <div className="balance-value">{formattedBalance} WETH</div>
            }
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {orderStatus && orderStatus.status !== 'failed' && (
        <div className="order-status">
          <div className="status-label">Order Status</div>
          <div className="status-value">
            {orderStatus.status === 'pending' && '⏳ Creating order...'}
            {orderStatus.status === 'opened' && '📝 Order opened, waiting for filler...'}
            {orderStatus.status === 'filled' && '✅ Bridge completed!'}
          </div>
          {orderStatus.orderId && (
            <div className="order-id">Order ID: {orderStatus.orderId.slice(0, 10)}...</div>
          )}
        </div>
      )}

      <button
        className="bridge-button"
        onClick={handleBridge}
        disabled={!canBridge}
      >
        {isBridging && <>Processing...</>}
        {!isBridging && !aztecWallet && 'Connect Aztec Wallet'}
        {!isBridging && aztecWallet && !evmAccount?.isConnected && 'Connect EVM Wallet'}
        {!isBridging && aztecWallet && evmAccount?.isConnected && currentConfig.buttonText}
      </button>

      {!isSupported && (
        <div className="error-message">
          ⚠️ Please switch to Base Sepolia network
        </div>
      )}
    </div>
  );
};
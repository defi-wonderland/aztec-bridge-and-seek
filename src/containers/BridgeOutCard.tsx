import React, { useState, useEffect } from 'react';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { useToken } from '../hooks/context/useToken';
import { useError } from '../providers/ErrorProvider';
import { formatUnits, parseUnits } from 'viem';
import { Fr } from '@aztec/aztec.js';
import { type OrderStatus } from '../utils/bridge/types';

const BRIDGE_CONFIG = {
  aztecWETH: '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb',
  baseSepoliaWETH: '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc',
  gateway: '0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
};

export const BridgeOutCard: React.FC = () => {
  const { account: evmAccount, connect: connectEVM, isSupported, network } = useEVMWallet();
  const { connectedAccount: aztecWallet, bridgeService } = useAztecWallet();
  const { tokenBalance, refreshBalance } = useToken();
  const { addMessage } = useError();
  const [amount, setAmount] = useState('');
  const [isBridging, setIsBridging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (aztecWallet) {
      refreshBalance();
    }
  }, [aztecWallet, refreshBalance]);

  const privateBalance = tokenBalance?.private ?? 0n;
  const publicBalance = tokenBalance?.public ?? 0n;
  const totalBalance = privateBalance + publicBalance;
  const formattedTotal = formatUnits(totalBalance, 18);
  const formattedPrivate = formatUnits(privateBalance, 18);
  const formattedPublic = formatUnits(publicBalance, 18);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const validateAmount = (): boolean => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    const amountWei = parseUnits(amount, 18);
    if (amountWei > privateBalance) {
      setError('Insufficient private balance');
      return false;
    }

    return true;
  };

  const handleBridge = async () => {
    if (!validateAmount()) return;
    if (!evmAccount?.address) {
      setError('Please connect your EVM wallet first');
      return;
    }
    if (!aztecWallet) {
      setError('Please connect your Aztec wallet first');
      return;
    }
    if (!bridgeService) {
      setError('Bridge service not available');
      return;
    }

    setIsBridging(true);
    setError(null);
    setOrderStatus(null);

    try {
      const amountWei = parseUnits(amount, 18);
      
      // Generate a random nonce for the order
      const nonce = Fr.random();
      
      console.log('Initiating bridge:', {
        amount: amount,
        amountWei: amountWei.toString(),
        from: aztecWallet.getAddress().toString(),
        to: evmAccount.address,
      });

      // Call bridge service to open order
      const result = await bridgeService.openAztecToEvmOrder({
        confidential: true, // Always use private balance
        sourceAmount: amountWei,
        targetAmount: amountWei, // 1:1 for WETH bridge
        recipientAddress: evmAccount.address,
        nonce,
        callbacks: {
          onOrderOpened: (orderId, txHash) => {
            console.log('Order opened:', { orderId, txHash });
            addMessage({
              message: `Bridge order opened: ${orderId.slice(0, 10)}...`,
              type: 'info',
              source: 'bridge',
            });
          },
          onOrderFilled: (orderId, fillTxHash) => {
            console.log('Order filled:', { orderId, fillTxHash });
            addMessage({
              message: `Bridge completed! Tokens sent to Base Sepolia`,
              type: 'success',
              source: 'bridge',
            });
          },
          onStatusUpdate: (status) => {
            setOrderStatus(status);
          },
          onError: (error) => {
            console.error('Bridge error:', error);
            setError(error.message);
          },
        },
      });

      if (result.status === 'filled') {
        setAmount('');
        await refreshBalance();
        addMessage({
          message: `Successfully bridged ${amount} WETH to Base Sepolia`,
          type: 'success',
          source: 'bridge',
        });
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Bridge transaction failed');
      }
    } catch (err) {
      console.error('Bridge error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Bridge transaction failed';
      setError(errorMessage);
      addMessage({
        message: errorMessage,
        type: 'error',
        source: 'bridge',
      });
    } finally {
      setIsBridging(false);
    }
  };

  const isConnected = evmAccount?.isConnected && aztecWallet;
  const canBridge = isConnected && amount && !isBridging && parseFloat(amount) > 0;

  return (
    <div className="bridge-out-card">
      <div className="bridge-header">
        <h2 className="bridge-title">
          <span className="bridge-icon">🌉</span>
          Bridge Out
        </h2>
        <p className="bridge-subtitle">Transfer WETH from Aztec to Base Sepolia</p>
      </div>

      <div className="bridge-route">
        <div className="route-endpoint">
          <span className="route-label">From</span>
          <div className="route-network">Aztec Sepolia</div>
          {aztecWallet && (
            <div className="route-address" title={aztecWallet.getAddress().toString()}>
              {aztecWallet.getAddress().toString().slice(0, 8)}...{aztecWallet.getAddress().toString().slice(-6)}
            </div>
          )}
        </div>
        <div className="route-arrow">→</div>
        <div className="route-endpoint">
          <span className="route-label">To</span>
          <div className="route-network">Base Sepolia</div>
          {evmAccount?.address ? (
            <div className="route-address" title={evmAccount.address}>
              {evmAccount.address.slice(0, 8)}...{evmAccount.address.slice(-6)}
            </div>
          ) : (
            <button 
              className="connect-evm-button"
              onClick={connectEVM}
              disabled={!isSupported}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="token-section">
        <div className="token-info">
          <span className="token-label">Token</span>
          <div className="token-details">
            <div className="token-name">WETH (Wrapped Ether)</div>
            <div className="token-address" title={BRIDGE_CONFIG.aztecWETH}>
              {BRIDGE_CONFIG.aztecWETH.slice(0, 6)}...{BRIDGE_CONFIG.aztecWETH.slice(-4)}
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
        {aztecWallet && (
          <div className="balance-info">
            <div className="balance-label">Available Balance</div>
            <div className="balance-value">{formattedTotal} WETH</div>
            <div className="balance-breakdown">
              Private: {formattedPrivate} | Public: {formattedPublic}
            </div>
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
        {isBridging ? (
          <>Processing...</>
        ) : !aztecWallet ? (
          'Connect Aztec Wallet'
        ) : !evmAccount?.isConnected ? (
          'Connect EVM Wallet'
        ) : (
          'Bridge to Base Sepolia'
        )}
      </button>

      {!isSupported && (
        <div className="error-message">
          ⚠️ Please switch to Base Sepolia network
        </div>
      )}
    </div>
  );
};
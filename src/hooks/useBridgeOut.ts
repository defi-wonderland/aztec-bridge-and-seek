import { useState } from 'react';
import { parseUnits } from 'viem';
import { Fr } from '@aztec/aztec.js/fields';
import { useAztecWallet } from './context/useAztecWallet';
import { useEVMWallet } from './context/useEVMWallet';
import { toastService } from '../services/toastService';
import { type OrderStatus } from '../types';

interface UseBridgeOutParams {
  onSuccess?: () => void;
}

export const useBridgeOut = ({ onSuccess }: UseBridgeOutParams = {}) => {
  const {
    wallet: aztecWallet,
    bridgeService,
    connectedAccount,
  } = useAztecWallet();
  const { account: evmAccount } = useEVMWallet();

  const [isBridging, setIsBridging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  const bridgeOut = async (amount: string, privateBalance: bigint) => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return { success: false };
    }

    const amountWei = parseUnits(amount, 18);
    if (amountWei > privateBalance) {
      setError('Insufficient private balance');
      return { success: false };
    }

    if (!evmAccount?.address) {
      setError('Please connect your EVM wallet first');
      return { success: false };
    }

    if (!aztecWallet) {
      setError('Please connect your Aztec wallet first');
      return { success: false };
    }

    if (!connectedAccount) {
      setError('Please connect your Aztec account first');
      return { success: false };
    }

    if (!bridgeService) {
      setError('Bridge service not available');
      return { success: false };
    }

    setIsBridging(true);
    setError(null);
    setOrderStatus(null);

    try {
      // Generate a random nonce for the order
      const nonce = Fr.random();

      console.log('Initiating bridge:', {
        amount: amount,
        amountWei: amountWei.toString(),
        from: connectedAccount.getAddress().toString(),
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
          onOrderOpened: (orderId: string, txHash: string) => {
            console.log('Order opened:', { orderId, txHash });
            toastService.info(
              `🌉 Bridge order opened: ${orderId.slice(0, 10)}...`
            );
          },
          onOrderFilled: (orderId: string, fillTxHash: string) => {
            console.log('Order filled:', { orderId, fillTxHash });
            toastService.success(
              `✅ Bridge completed! Tokens sent to Base Sepolia`
            );
          },
          onStatusUpdate: (status: OrderStatus) => {
            setOrderStatus(status);
          },
          onError: (error: Error) => {
            console.error('Bridge error:', error);
            setError(error.message);
          },
        },
      });

      if (result.status === 'filled') {
        toastService.success(
          `✅ Successfully bridged ${amount} WETH to Base Sepolia`
        );
        onSuccess?.();
        return { success: true };
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Bridge transaction failed');
      }

      return { success: true };
    } catch (err) {
      console.error('Bridge error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Bridge transaction failed';
      setError(errorMessage);
      console.error('❌ Bridge error:', errorMessage);
      toastService.error(`❌ Bridge transaction failed`);
      return { success: false };
    } finally {
      setIsBridging(false);
    }
  };

  const clearError = () => setError(null);

  return {
    bridgeOut,
    isBridging,
    error,
    orderStatus,
    clearError,
  };
};

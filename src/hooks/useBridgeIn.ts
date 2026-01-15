import { useState, useMemo } from 'react';
import { parseUnits } from 'viem';
import { useConfig } from 'wagmi';
import { useEVMWallet } from './context/useEVMWallet';
import { useAztecWallet } from './context/useAztecWallet';
import { usePendingClaims } from './usePendingClaims';
import { toastService } from '../services/toastService';
import { EVMBridgeService } from '../services/evm/features/EVMBridgeService';
import { type OrderStatus } from '../types';
import { useError } from '../providers/ErrorProvider';

interface UseBridgeInParams {
  onSuccess?: () => void;
}

export const useBridgeIn = ({ onSuccess }: UseBridgeInParams = {}) => {
  const wagmiConfig = useConfig();
  const { account: evmAccount } = useEVMWallet();
  const { wallet: aztecWallet, bridgeService: aztecBridgeService } =
    useAztecWallet();

  const { pendingClaims, refreshPendingClaims } = usePendingClaims();

  const [isBridging, setIsBridging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const { addMessage } = useError();

  // Create bridge service instance
  const evmBridgeService = useMemo(() => {
    return new EVMBridgeService(
      wagmiConfig,
      aztecWallet,
      aztecBridgeService,
      evmAccount
    );
  }, [wagmiConfig, evmAccount, aztecWallet, aztecBridgeService]);

  const activePendingClaim = useMemo(() => {
    if (!activeOrderId) {
      return null;
    }
    return (
      pendingClaims.find(
        (claim) => claim.orderId.toLowerCase() === activeOrderId.toLowerCase()
      ) ?? null
    );
  }, [pendingClaims, activeOrderId]);

  const bridgeIn = async (amount: string, evmWethBalance: bigint) => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return { success: false };
    }

    const amountWei = parseUnits(amount, 18);
    if (amountWei > evmWethBalance) {
      setError('Insufficient WETH balance on Base Sepolia');
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

    setIsBridging(true);
    setError(null);
    setOrderStatus({ status: 'pending' });
    setActiveOrderId(null);

    try {
      const recipient = aztecWallet.connectedAccount?.getAddress().toString();
      console.log('Initiating bridge in:', {
        amount: amount,
        amountWei: amountWei.toString(),
        from: evmAccount.address,
        to: recipient,
      });

      // Call bridge service to open order
      await evmBridgeService.openEvmToAztecOrder({
        senderAddress: evmAccount.address,
        sourceAmount: amountWei,
        targetAmount: amountWei, // 1:1 for WETH bridge
        recipientAddress: recipient as string,
        callbacks: {
          onOrderOpened: (orderId: string, txHash: string) => {
            console.log('Order opened:', { orderId, txHash });
            setActiveOrderId(orderId);
            setOrderStatus({ status: 'opened', orderId, txHash });
            addMessage({
              message: `Bridge order opened: ${orderId.slice(0, 10)}...`,
              type: 'info',
              source: 'bridge',
            });
          },
          onOrderFilled: (orderId: string, fillTxHash: string) => {
            console.log('Order filled:', { orderId, fillTxHash });
            addMessage({
              message: `Relayer filled your bridge order. Generating claim proof...`,
              type: 'info',
              source: 'bridge',
            });
          },
          onOrderClaimed: (orderId: string) => {
            addMessage({
              message: 'Bridge completed! Tokens claimed on Aztec.',
              type: 'success',
              source: 'bridge',
            });
            onSuccess?.();
            refreshPendingClaims();
            setActiveOrderId(orderId);
            toastService.success(`✅ Bridge completed! Tokens sent to Aztec`);
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

      // if (result.status === 'filled') {
      //   addMessage({
      //     message: `Successfully bridged ${amount} WETH to Aztec`,
      //     type: 'success',
      //     source: 'bridge',
      //   });
      //   onSuccess?.();
      //   return { success: true };
      // } else if (result.status === 'failed') {
      //   throw new Error(result.error || 'Bridge transaction failed');
      // }

      refreshPendingClaims();
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
    bridgeIn,
    isBridging,
    error,
    orderStatus,
    clearError,
    pendingClaims,
    activeOrderId,
    activePendingClaim,
  };
};

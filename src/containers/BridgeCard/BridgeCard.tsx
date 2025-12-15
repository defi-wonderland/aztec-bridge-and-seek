import React, { useState, useMemo, useCallback } from 'react';
import { useConfig } from 'wagmi';
import { Fr } from '@aztec/aztec.js/fields';
import { formatUnits } from 'viem';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { BridgeForm } from '../BridgeForm';
import { BridgeDirection } from '../../types';
import { useEVMWallet } from '../../hooks/context/useEVMWallet';
import { useAztecWallet } from '../../hooks/context/useAztecWallet';
import { useTabContracts, usePendingClaims } from '../../hooks';
import {
  EVMBridgeService,
  parseFilledLog,
} from '../../services/evm/features/EVMBridgeService';
import { toastService } from '../../services/toastService';
import { AZTEC_GATEWAY, FILLED_PRIVATELY } from '../../config';
import { ContractLoadingState } from '../../components';
import { OrderData } from '../../utils/bridge/OrderData';
import { BridgeSkeleton } from './BridgeSkeleton';

export const BridgeCard: React.FC = () => {
  const [activeDirection, setActiveDirection] =
    useState<BridgeDirection>('out');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const wagmiConfig = useConfig();
  const { account: evmAccount } = useEVMWallet();
  const {
    wallet: aztecWallet,
    bridgeService: aztecBridgeService,
    isInitialized,
  } = useAztecWallet();
  const { pendingClaims, removePendingClaim, refreshPendingClaims } =
    usePendingClaims();
  const { contractsReady } = useTabContracts('bridge', isInitialized);

  const normalizeOrderId = useCallback((value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  }, []);

  // Create bridge service instance for testing
  const bridgeService = useMemo(() => {
    if (!aztecWallet || !aztecBridgeService) {
      return null;
    }
    try {
      return new EVMBridgeService(
        wagmiConfig,
        aztecWallet,
        aztecBridgeService,
        evmAccount
      );
    } catch (error) {
      console.error('Failed to create EVMBridgeService:', error);
      return null;
    }
  }, [wagmiConfig, evmAccount, aztecWallet, aztecBridgeService]);

  const handleToggle = () => {
    setActiveDirection(activeDirection === 'out' ? 'in' : 'out');
  };

  const handleManualClaim = async () => {
    if (!aztecWallet || !aztecBridgeService) {
      toastService.error(
        '❌ Bridge service not available. Please connect wallets.'
      );
      return;
    }

    if (!orderIdInput.trim()) {
      toastService.error('❌ Please enter an order ID to claim');
      return;
    }

    const normalizedOrderId = normalizeOrderId(orderIdInput);
    const savedClaim = pendingClaims.find(
      (claim) => claim.orderId.toLowerCase() === normalizedOrderId.toLowerCase()
    );

    if (!savedClaim) {
      toastService.error('❌ Order ID not found in pending claims storage');
      console.warn(
        '[MANUAL_CLAIM] Order not found in storage:',
        normalizedOrderId
      );
      return;
    }

    setIsClaiming(true);

    try {
      console.log(
        '[MANUAL_CLAIM] Starting manual claim for',
        normalizedOrderId
      );

      const status =
        await aztecBridgeService.getAztecOrderStatus(normalizedOrderId);
      console.log('[MANUAL_CLAIM] Current gateway status:', status);

      if (Number(status) !== FILLED_PRIVATELY) {
        toastService.error(`❌ Order status ${status} is not claimable yet`);
        console.warn('[MANUAL_CLAIM] Order not claimable, status:', status);
        return;
      }

      const aztecNode = aztecWallet.getAztecNode?.();
      if (!aztecNode) {
        throw new Error('Aztec node not available');
      }

      console.log('[MANUAL_CLAIM] Fetching filled logs from Aztec node');
      const { logs } = await aztecNode.getPublicLogs({
        contractAddress: AztecAddress.fromString(AZTEC_GATEWAY),
      });
      const parsedLogs = logs
        .map(({ log }) => {
          try {
            return parseFilledLog(log.fields);
          } catch (parseError) {
            console.warn(
              '[MANUAL_CLAIM] Failed to parse filled log entry:',
              parseError
            );
            return null;
          }
        })
        .filter(
          (entry): entry is ReturnType<typeof parseFilledLog> => entry !== null
        );
      const matchingLog = parsedLogs.find(
        (log) => log.orderId.toLowerCase() === normalizedOrderId.toLowerCase()
      );

      if (!matchingLog) {
        throw new Error('Filled log not found yet. Try again shortly.');
      }

      console.log('[MANUAL_CLAIM] Log found. Submitting claim_private...');
      await aztecBridgeService.claimPrivateOrder(
        normalizedOrderId,
        Fr.fromString(savedClaim.claimData.secret),
        matchingLog.originData,
        matchingLog.fillerData
      );

      console.log('[MANUAL_CLAIM] Claim transaction sent successfully');

      let amountDisplay = '';
      try {
        const decoded = OrderData.decode(
          savedClaim.claimData.orderCreation.encodedOrderData
        );
        amountDisplay = decoded.amountOut
          ? `${formatUnits(BigInt(decoded.amountOut), 18)} WETH`
          : '';
      } catch (decodeError) {
        console.warn(
          '[MANUAL_CLAIM] Failed to decode order amount:',
          decodeError
        );
      }

      const message = amountDisplay
        ? `✅ Claim complete! You just received ${amountDisplay} of bridged WETH on Aztec Devnet from Base Sepolia (${normalizedOrderId}).`
        : `✅ Claim complete! You just received your bridged WETH on Aztec Devnet from Base Sepolia (${normalizedOrderId}).`;

      toastService.success(message, { autoClose: 10000 });

      removePendingClaim(normalizedOrderId);
      refreshPendingClaims();
    } catch (error) {
      console.error('[MANUAL_CLAIM] Failed to claim order:', error);
      toastService.error(
        `❌ Failed to claim order: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsClaiming(false);
    }
  };

  const handleLogOrderStatus = async () => {
    if (!aztecBridgeService || !aztecWallet) {
      toastService.error(
        '❌ Bridge service not available. Please connect wallets.'
      );
      return;
    }

    if (!orderIdInput.trim()) {
      toastService.error('❌ Please enter an order ID');
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

      const status = await gateway.methods.get_order_status(orderId).simulate({
        from: aztecWallet.connectedAccount?.getAddress(),
        skipTxValidation: true,
      });

      console.log('Order Status:', status.toString());
      console.log('Order Status (number):', Number(status));
      console.log('===========================');

      toastService.info(
        `ℹ️ Order status: ${status.toString()} (${Number(status)})`
      );
    } catch (error) {
      console.error('Log order status error:', error);
      toastService.error(
        `❌ Failed to log order status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLogging(false);
    }
  };

  if (!isInitialized) {
    return <BridgeSkeleton />;
  }

  if (!contractsReady) {
    return (
      <ContractLoadingState className="bridge-card" icon="🌉" title="Bridge" />
    );
  }

  return (
    <div className="bridge-card">
      {/* Sub-tabs for Bridge In/Out */}
      <div className="bridge-subtabs">
        <div className="bridge-subtabs-list" onClick={handleToggle}>
          <div
            className={`bridge-subtab ${activeDirection === 'out' ? 'active' : ''}`}
          >
            <span className="bridge-subtab-icon">🌉</span>
            Bridge Out
          </div>
          <div
            className={`bridge-subtab ${activeDirection === 'in' ? 'active' : ''}`}
          >
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

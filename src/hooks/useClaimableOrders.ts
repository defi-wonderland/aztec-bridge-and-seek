import { useCallback, useEffect, useRef, useState } from 'react';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { formatUnits } from 'viem';
import { usePendingClaims } from './usePendingClaims';
import { parseFilledLog } from '../services/evm/features/EVMBridgeService';
import { toastService } from '../services/toastService';
import { OrderData } from '../utils/bridge/OrderData';
import { AztecStorageService } from '../services/aztec/core';
import { AZTEC_GATEWAY, FILLED_PRIVATELY } from '../config';
import type { PendingClaimRecord } from '../types';
import type { AztecBridgeService } from '../services/aztec/features/AztecBridgeService';
import type { EmbeddedAztecWallet } from '../services/aztec/core/EmbeddedAztecWallet';

const LOG_KEY = '[CLAIMABLE_ORDERS]';

export interface ClaimableOrder extends PendingClaimRecord {
  onChainStatus: number | null;
  isClaimable: boolean;
  decodedAmount: string | null;
}

interface UseClaimableOrdersParams {
  aztecWallet: EmbeddedAztecWallet | null;
  bridgeService: AztecBridgeService | null;
}

interface UseClaimableOrdersReturn {
  claimableOrders: ClaimableOrder[];
  isLoadingStatuses: boolean;
  claimingOrderIds: Set<string>;
  claimOrder: (orderId: string) => Promise<void>;
  refreshStatuses: () => Promise<void>;
}

/**
 * Hook to manage claimable bridge-in orders.
 * Fetches on-chain status for pending claims and provides claim functionality.
 */
export const useClaimableOrders = ({
  aztecWallet,
  bridgeService,
}: UseClaimableOrdersParams): UseClaimableOrdersReturn => {
  const { pendingClaims, removePendingClaim, refreshPendingClaims } = usePendingClaims();
  const [onChainStatuses, setOnChainStatuses] = useState<Record<string, number>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [claimingOrderIds, setClaimingOrderIds] = useState<Set<string>>(new Set());

  // Storage service for persisting status updates
  const storageServiceRef = useRef<AztecStorageService | null>(null);
  if (!storageServiceRef.current) {
    storageServiceRef.current = new AztecStorageService();
  }
  const storageService = storageServiceRef.current;

  /**
   * Decode amount from encoded order data
   */
  const decodeAmount = useCallback((encodedOrderData: string): string | null => {
    try {
      if (!encodedOrderData) {
        console.warn(`${LOG_KEY} No encoded order data provided`);
        return null;
      }
      const decoded = OrderData.decode(encodedOrderData);
      console.log(`${LOG_KEY} Decoded order data:`, {
        amountIn: decoded.amountIn?.toString(),
        amountOut: decoded.amountOut?.toString(),
        dataLength: encodedOrderData.length,
      });
      if (decoded.amountOut) {
        return `${formatUnits(decoded.amountOut, 18)} WETH`;
      }
      return null;
    } catch (error) {
      console.warn(`${LOG_KEY} Failed to decode order amount:`, error, {
        encodedOrderData: encodedOrderData?.slice(0, 100) + '...',
      });
      return null;
    }
  }, []);

  /**
   * Fetch on-chain status for pending claims that aren't already ready to claim
   */
  const refreshStatuses = useCallback(async () => {
    if (!bridgeService || pendingClaims.length === 0) {
      return;
    }

    // Only fetch status for claims that aren't already ready to claim
    const claimsToFetch = pendingClaims.filter((claim) => claim.status !== 'ready_to_claim');
    if (claimsToFetch.length === 0) {
      return;
    }

    setIsLoadingStatuses(true);
    const newStatuses: Record<string, number> = {};
    let didUpdateAnyStatus = false;

    try {
      await Promise.all(
        claimsToFetch.map(async (claim) => {
          try {
            const status = await bridgeService.getAztecOrderStatus(claim.orderId);
            const statusNumber = Number(status);
            newStatuses[claim.orderId] = statusNumber;

            // Persist ready_to_claim status so it's available immediately on reload
            if (statusNumber === FILLED_PRIVATELY) {
              console.log(`${LOG_KEY} Order ${claim.orderId} is now claimable, persisting status`);
              storageService.upsertPendingClaim({
                ...claim,
                status: 'ready_to_claim',
                updatedAt: new Date().toISOString(),
              });
              didUpdateAnyStatus = true;
            }
          } catch (error) {
            console.warn(`${LOG_KEY} Failed to fetch status for ${claim.orderId}:`, error);
            newStatuses[claim.orderId] = -1; // Error state
          }
        }),
      );
      setOnChainStatuses((prev) => ({ ...prev, ...newStatuses }));
      // Only refresh pending claims if we actually updated a status to avoid infinite loop
      if (didUpdateAnyStatus) {
        refreshPendingClaims();
      }
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [bridgeService, pendingClaims, storageService, refreshPendingClaims]);

  /**
   * Fetch statuses when services become available
   * Only triggers on initial load or when bridgeService becomes available
   */
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (bridgeService && pendingClaims.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      refreshStatuses();
    }
  }, [bridgeService, pendingClaims.length, refreshStatuses]);

  /**
   * Claim a specific order
   */
  const claimOrder = useCallback(
    async (orderId: string) => {
      if (!aztecWallet || !bridgeService) {
        toastService.error('Bridge service not available. Please connect wallets.');
        return;
      }

      const claim = pendingClaims.find(
        (c) => c.orderId.toLowerCase() === orderId.toLowerCase(),
      );

      if (!claim) {
        toastService.error('Order not found in pending claims.');
        return;
      }

      // Set claiming state
      setClaimingOrderIds((prev) => new Set(prev).add(orderId));

      try {
        console.log(`${LOG_KEY} Starting claim for ${orderId}`);

        // Verify order is claimable
        const status = await bridgeService.getAztecOrderStatus(orderId);
        if (Number(status) !== FILLED_PRIVATELY) {
          toastService.error(`Order status ${status} is not claimable yet.`);
          return;
        }

        // Fetch public logs
        const aztecNode = aztecWallet.getAztecNode?.();
        if (!aztecNode) {
          throw new Error('Aztec node not available');
        }

        console.log(`${LOG_KEY} Fetching filled logs from Aztec node`);
        const { logs } = await aztecNode.getPublicLogs({
          contractAddress: AztecAddress.fromString(AZTEC_GATEWAY),
        });

        // Parse logs to find matching order
        const parsedLogs = logs
          .map(({ log }) => {
            try {
              return parseFilledLog(log.fields);
            } catch {
              return null;
            }
          })
          .filter((entry): entry is ReturnType<typeof parseFilledLog> => entry !== null);

        const matchingLog = parsedLogs.find(
          (log) => log.orderId.toLowerCase() === orderId.toLowerCase(),
        );

        if (!matchingLog) {
          throw new Error('Filled log not found yet. Try again shortly.');
        }

        // Execute claim
        console.log(`${LOG_KEY} Submitting claim_private for ${orderId}`);
        await bridgeService.claimPrivateOrder(
          orderId,
          Fr.fromString(claim.claimData.secret),
          matchingLog.originData,
          matchingLog.fillerData,
        );

        // Success
        console.log(`${LOG_KEY} Claim successful for ${orderId}`);
        const amountDisplay = decodeAmount(claim.claimData.orderCreation.encodedOrderData);
        const message = amountDisplay
          ? `Claim complete! You received ${amountDisplay} on Aztec.`
          : `Claim complete! You received your bridged WETH on Aztec.`;
        toastService.success(message, { autoClose: 10000 });

        // Remove from storage
        removePendingClaim(orderId);
        refreshPendingClaims();
      } catch (error) {
        console.error(`${LOG_KEY} Failed to claim order ${orderId}:`, error);
        toastService.error(
          `Failed to claim order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        setClaimingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [aztecWallet, bridgeService, pendingClaims, decodeAmount, removePendingClaim, refreshPendingClaims],
  );

  /**
   * Build claimable orders with decoded data and status
   * Uses persisted status for immediate display, falls back to on-chain status
   */
  const claimableOrders: ClaimableOrder[] = pendingClaims
    .filter((claim) => claim.status !== 'claimed')
    .map((claim) => {
      const onChainStatus = onChainStatuses[claim.orderId] ?? null;
      // Order is claimable if persisted status is ready_to_claim OR on-chain status confirms it
      const isClaimable = claim.status === 'ready_to_claim' || onChainStatus === FILLED_PRIVATELY;
      const decodedAmount = decodeAmount(claim.claimData.orderCreation.encodedOrderData);

      return {
        ...claim,
        onChainStatus,
        isClaimable,
        decodedAmount,
      };
    });

  return {
    claimableOrders,
    isLoadingStatuses,
    claimingOrderIds,
    claimOrder,
    refreshStatuses,
  };
};

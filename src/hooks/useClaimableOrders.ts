import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { formatUnits } from 'viem';
import { usePendingClaims } from './usePendingClaims';
import { parseFilledLog } from '../services/evm/features/EVMBridgeService';
import { toastService } from '../services/toastService';
import { OrderData } from '../utils/bridge/OrderData';
import { AztecStorageService } from '../services/aztec/core';
import bridgeSwapHookAbi from '../abi/bridgeSwapHook.json';
import {
  AZTEC_GATEWAY,
  FILLED_PRIVATELY,
  BASE_SEPOLIA_CHAIN_ID,
  BRIDGE_SWAP_HOOK_ADDRESS,
} from '../config';
import type { PendingClaimRecord } from '../types';
import type { AztecBridgeService } from '../services/aztec/features/AztecBridgeService';
import type { EmbeddedAztecWallet } from '../services/aztec/core/EmbeddedAztecWallet';

const LOG_KEY = '[CLAIMABLE_ORDERS]';

export interface ClaimableOrder extends PendingClaimRecord {
  onChainStatus: number | null;
  isClaimable: boolean;
  decodedAmount: string | null;
  /** True if this swap is still fetching its hookOrderId */
  isRecovering?: boolean;
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
  const wagmiConfig = useConfig();
  const { pendingClaims, removePendingClaim, refreshPendingClaims } =
    usePendingClaims();
  const [onChainStatuses, setOnChainStatuses] = useState<
    Record<string, number>
  >({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [claimingOrderIds, setClaimingOrderIds] = useState<Set<string>>(
    new Set()
  );
  // Track swaps that are recovering hookOrderId
  const [recoveringSwapIds, setRecoveringSwapIds] = useState<Set<string>>(
    new Set()
  );

  // Storage service for persisting status updates
  const storageServiceRef = useRef<AztecStorageService | null>(null);
  if (!storageServiceRef.current) {
    storageServiceRef.current = new AztecStorageService();
  }
  const storageService = storageServiceRef.current;

  /**
   * Decode amount from encoded order data (for bridge claims)
   */
  const decodeAmountFromOrderData = useCallback(
    (encodedOrderData: string): string | null => {
      try {
        if (!encodedOrderData) {
          return null;
        }
        const decoded = OrderData.decode(encodedOrderData);
        if (decoded.amountOut) {
          return `${formatUnits(decoded.amountOut, 18)} WETH`;
        }
        return null;
      } catch (error) {
        console.warn(`${LOG_KEY} Failed to decode order amount:`, error);
        return null;
      }
    },
    []
  );

  /**
   * Get display amount for a claim based on its type
   */
  const getDisplayAmount = useCallback(
    (claim: PendingClaimRecord): string | null => {
      // For swaps, use the stored expected output (USDC quote)
      if (claim.type === 'swap' && claim.claimData.amountOut) {
        // amountOut is the USDC quote string (e.g., "12.345")
        return `~${claim.claimData.amountOut} USDC`;
      }

      // For bridge claims, decode from encoded order data
      return decodeAmountFromOrderData(
        claim.claimData.orderCreation.encodedOrderData
      );
    },
    [decodeAmountFromOrderData]
  );

  /**
   * Fetch hookOrderId for a swap claim that only has bridgeOutOrderId
   */
  const fetchHookOrderId = useCallback(
    async (bridgeOutOrderId: string): Promise<string | null> => {
      const zeroHash =
        '0x0000000000000000000000000000000000000000000000000000000000000000';

      try {
        const hookOrderId = (await readContract(wagmiConfig, {
          address: BRIDGE_SWAP_HOOK_ADDRESS as `0x${string}`,
          abi: bridgeSwapHookAbi,
          functionName: 'orderIdMapping',
          args: [bridgeOutOrderId as `0x${string}`],
          chainId: BASE_SEPOLIA_CHAIN_ID,
        })) as `0x${string}`;

        if (hookOrderId && hookOrderId !== zeroHash) {
          return hookOrderId;
        }
        return null;
      } catch (error) {
        console.warn(
          `${LOG_KEY} Failed to fetch hookOrderId for ${bridgeOutOrderId}:`,
          error
        );
        return null;
      }
    },
    [wagmiConfig]
  );

  /**
   * Recover swap claims that are missing hookOrderId
   */
  const recoverSwapClaims = useCallback(async () => {
    // Find swap claims that have bridgeOutOrderId but no hookOrderId
    const swapsNeedingRecovery = pendingClaims.filter(
      (claim) =>
        claim.type === 'swap' &&
        claim.swapData?.bridgeOutOrderId &&
        !claim.swapData?.hookOrderId
    );

    if (swapsNeedingRecovery.length === 0) {
      return;
    }

    console.log(
      `${LOG_KEY} Recovering ${swapsNeedingRecovery.length} swap claims...`
    );

    for (const claim of swapsNeedingRecovery) {
      const bridgeOutOrderId = claim.swapData!.bridgeOutOrderId!;

      // Skip if already recovering
      if (recoveringSwapIds.has(bridgeOutOrderId)) {
        continue;
      }

      setRecoveringSwapIds((prev) => new Set(prev).add(bridgeOutOrderId));

      try {
        const hookOrderId = await fetchHookOrderId(bridgeOutOrderId);

        if (hookOrderId) {
          console.log(
            `${LOG_KEY} Recovered hookOrderId for ${bridgeOutOrderId}: ${hookOrderId}`
          );

          // Remove old record and create new one with hookOrderId
          storageService.removePendingClaim(bridgeOutOrderId);
          storageService.upsertPendingClaim({
            ...claim,
            orderId: hookOrderId,
            updatedAt: new Date().toISOString(),
            swapData: {
              ...claim.swapData,
              hookOrderId,
            },
          });
          refreshPendingClaims();
        } else {
          console.log(
            `${LOG_KEY} hookOrderId not ready yet for ${bridgeOutOrderId}`
          );
        }
      } catch (error) {
        console.warn(
          `${LOG_KEY} Failed to recover swap claim ${bridgeOutOrderId}:`,
          error
        );
      } finally {
        setRecoveringSwapIds((prev) => {
          const next = new Set(prev);
          next.delete(bridgeOutOrderId);
          return next;
        });
      }
    }
  }, [
    pendingClaims,
    recoveringSwapIds,
    fetchHookOrderId,
    storageService,
    refreshPendingClaims,
  ]);

  /**
   * Fetch on-chain status for pending claims that aren't already ready to claim
   */
  const refreshStatuses = useCallback(async () => {
    if (pendingClaims.length === 0) {
      return;
    }

    setIsLoadingStatuses(true);

    try {
      // First, try to recover any swap claims missing hookOrderId
      await recoverSwapClaims();
    } catch (error) {
      console.warn(`${LOG_KEY} Error recovering swap claims:`, error);
    }

    if (!bridgeService) {
      setIsLoadingStatuses(false);
      return;
    }

    // Only fetch status for claims that have a valid orderId (hookOrderId for swaps)
    // Skip swaps that are still missing hookOrderId
    const claimsToFetch = pendingClaims.filter(
      (claim) =>
        claim.status !== 'ready_to_claim' &&
        // For swaps, only fetch if we have hookOrderId
        (claim.type !== 'swap' || claim.swapData?.hookOrderId)
    );
    if (claimsToFetch.length === 0) {
      setIsLoadingStatuses(false);
      return;
    }
    const newStatuses: Record<string, number> = {};
    let didUpdateAnyStatus = false;

    try {
      await Promise.all(
        claimsToFetch.map(async (claim) => {
          try {
            const status = await bridgeService.getAztecOrderStatus(
              claim.orderId
            );
            const statusNumber = Number(status);
            newStatuses[claim.orderId] = statusNumber;

            // Persist ready_to_claim status so it's available immediately on reload
            if (statusNumber === FILLED_PRIVATELY) {
              console.log(
                `${LOG_KEY} Order ${claim.orderId} is now claimable, persisting status`
              );
              storageService.upsertPendingClaim({
                ...claim,
                status: 'ready_to_claim',
                updatedAt: new Date().toISOString(),
              });
              didUpdateAnyStatus = true;
            }
          } catch (error) {
            console.warn(
              `${LOG_KEY} Failed to fetch status for ${claim.orderId}:`,
              error
            );
            newStatuses[claim.orderId] = -1; // Error state
          }
        })
      );
      setOnChainStatuses((prev) => ({ ...prev, ...newStatuses }));
      // Only refresh pending claims if we actually updated a status to avoid infinite loop
      if (didUpdateAnyStatus) {
        refreshPendingClaims();
      }
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [
    bridgeService,
    pendingClaims,
    storageService,
    refreshPendingClaims,
    recoverSwapClaims,
  ]);

  /**
   * Fetch statuses when services become available
   * Also triggers recovery for swaps missing hookOrderId
   */
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (pendingClaims.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      refreshStatuses();
    }
  }, [pendingClaims.length, refreshStatuses]);

  /**
   * Claim a specific order
   */
  const claimOrder = useCallback(
    async (orderId: string) => {
      if (!aztecWallet || !bridgeService) {
        toastService.error(
          'Bridge service not available. Please connect wallets.'
        );
        return;
      }

      const claim = pendingClaims.find(
        (c) => c.orderId.toLowerCase() === orderId.toLowerCase()
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
          .filter(
            (entry): entry is ReturnType<typeof parseFilledLog> =>
              entry !== null
          );

        const matchingLog = parsedLogs.find(
          (log) => log.orderId.toLowerCase() === orderId.toLowerCase()
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
          matchingLog.fillerData
        );

        // Success
        console.log(`${LOG_KEY} Claim successful for ${orderId}`);
        const amountDisplay = getDisplayAmount(claim);
        const message = amountDisplay
          ? `Claim complete! You received ${amountDisplay} on Aztec.`
          : `Claim complete! You received your bridged tokens on Aztec.`;
        toastService.success(message, { autoClose: 10000 });

        // Remove from storage
        removePendingClaim(orderId);
        refreshPendingClaims();
      } catch (error) {
        console.error(`${LOG_KEY} Failed to claim order ${orderId}:`, error);
        toastService.error(
          `Failed to claim order: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setClaimingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [
      aztecWallet,
      bridgeService,
      pendingClaims,
      getDisplayAmount,
      removePendingClaim,
      refreshPendingClaims,
    ]
  );

  /**
   * Build claimable orders with decoded data and status
   * Uses persisted status for immediate display, falls back to on-chain status
   */
  const claimableOrders: ClaimableOrder[] = pendingClaims
    .filter((claim) => claim.status !== 'claimed')
    .map((claim) => {
      // Check if this is a swap that's still recovering hookOrderId
      const needsHookOrderId = Boolean(
        claim.type === 'swap' &&
          claim.swapData?.bridgeOutOrderId &&
          !claim.swapData?.hookOrderId
      );
      const isRecovering =
        needsHookOrderId &&
        recoveringSwapIds.has(claim.swapData?.bridgeOutOrderId ?? '');

      const onChainStatus = onChainStatuses[claim.orderId] ?? null;
      // Order is claimable if:
      // - Not waiting for hookOrderId
      // - Persisted status is ready_to_claim OR on-chain status confirms it
      const isClaimable =
        !needsHookOrderId &&
        (claim.status === 'ready_to_claim' ||
          onChainStatus === FILLED_PRIVATELY);
      const decodedAmount = getDisplayAmount(claim);

      return {
        ...claim,
        onChainStatus,
        isClaimable,
        isRecovering,
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

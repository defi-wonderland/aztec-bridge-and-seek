import { useCallback, useEffect, useRef, useState } from 'react';
import { AztecStorageService, PENDING_CLAIMS_STORAGE_KEY } from '../services/aztec/core';
import { type PendingClaimRecord, type PendingClaimOrderCreationData } from '../types';

type StoredPendingClaimRecord = PendingClaimRecord & {
  status: PendingClaimRecord['status'] | 'opening';
  claimData: PendingClaimRecord['claimData'] & {
    orderId?: {
      hex: string;
      bytes: number[];
    };
    orderCreation: PendingClaimOrderCreationData & {
      network?: string;
      gatewayAddress?: string;
    };
  };
};

export const usePendingClaims = () => {
  const LOG_KEY = '[PENDING_CLAIMS]';
  const storageServiceRef = useRef<AztecStorageService | null>(null);
  if (!storageServiceRef.current) {
    storageServiceRef.current = new AztecStorageService();
  }
  const storageService = storageServiceRef.current;
  const [pendingClaims, setPendingClaims] = useState<PendingClaimRecord[]>([]);

  const normalizeClaimRecord = useCallback(
    (record: StoredPendingClaimRecord): PendingClaimRecord => {
      let didChange = false;
      const rawStatus = record.status as PendingClaimRecord['status'] | 'opening';
      let status: PendingClaimRecord['status'] =
        rawStatus === 'opening' ? 'open' : rawStatus;
      if (rawStatus === 'opening') {
        didChange = true;
      }

      const legacyOrderCreation = record.claimData.orderCreation as Partial<PendingClaimOrderCreationData> &
        Pick<PendingClaimOrderCreationData, 'encodedOrderData' | 'orderDataType' | 'fillDeadline'> & {
          network?: string;
          gatewayAddress?: string;
        };

      const hasOriginFields =
        typeof legacyOrderCreation.originNetwork === 'string' &&
        typeof legacyOrderCreation.originGatewayAddress === 'string';

      const orderCreation: PendingClaimOrderCreationData = hasOriginFields
        ? (legacyOrderCreation as PendingClaimOrderCreationData)
        : {
            originNetwork: legacyOrderCreation.originNetwork ?? legacyOrderCreation.network ?? 'Base Sepolia',
            originGatewayAddress:
              legacyOrderCreation.originGatewayAddress ?? legacyOrderCreation.gatewayAddress ?? '',
            encodedOrderData: legacyOrderCreation.encodedOrderData,
            orderDataType: legacyOrderCreation.orderDataType,
            fillDeadline: legacyOrderCreation.fillDeadline,
          };

      if (!hasOriginFields) {
        didChange = true;
      }

      const normalizedClaimData = {
        secret: record.claimData.secret,
        orderCreation,
      };

      const normalizedRecord: PendingClaimRecord = {
        orderId: record.orderId,
        status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        sourceTxHash: record.sourceTxHash,
        claimData: normalizedClaimData,
      };

      if (didChange) {
        console.log(`${LOG_KEY} Normalizing pending claim ${record.orderId}`);
        storageService.upsertPendingClaim(normalizedRecord);
      }

      return normalizedRecord;
    },
    [LOG_KEY, storageService],
  );

  const refreshPendingClaims = useCallback(() => {
    try {
      const rawClaims = storageService.getPendingClaims() as StoredPendingClaimRecord[];
      const normalizedClaims = rawClaims.map(normalizeClaimRecord);
      setPendingClaims(normalizedClaims);
    } catch (error) {
      console.warn('Failed to read pending claims from storage:', error);
      setPendingClaims([]);
    }
  }, [normalizeClaimRecord, storageService]);

  useEffect(() => {
    refreshPendingClaims();
  }, [refreshPendingClaims]);

  useEffect(() => {
    if (!pendingClaims.length) {
      console.log(LOG_KEY, 'No pending claims found in storage');
      return;
    }
    console.log(LOG_KEY, 'Pending claims loaded from storage:', pendingClaims);
  }, [pendingClaims]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PENDING_CLAIMS_STORAGE_KEY) {
        refreshPendingClaims();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshPendingClaims]);

  const removePendingClaim = useCallback(
    (orderId: string) => {
      try {
        storageService.removePendingClaim(orderId);
        refreshPendingClaims();
      } catch (error) {
        console.warn(`${LOG_KEY} Failed to remove pending claim ${orderId}:`, error);
      }
    },
    [refreshPendingClaims, storageService],
  );

  return {
    pendingClaims,
    refreshPendingClaims,
    removePendingClaim,
  };
};


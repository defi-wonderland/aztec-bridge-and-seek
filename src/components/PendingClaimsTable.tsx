import React from 'react';
import { useClaimableOrders, type ClaimableOrder } from '../hooks/useClaimableOrders';
import type { AztecBridgeService } from '../services/aztec/features/AztecBridgeService';
import type { EmbeddedAztecWallet } from '../services/aztec/core/EmbeddedAztecWallet';

interface PendingClaimsTableProps {
  aztecWallet: EmbeddedAztecWallet | null;
  bridgeService: AztecBridgeService | null;
}

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

/**
 * Truncate an order ID for display
 */
const truncateOrderId = (orderId: string): string => {
  if (orderId.length <= 16) return orderId;
  return `${orderId.slice(0, 8)}...${orderId.slice(-6)}`;
};

/**
 * Get status display text and style
 * Prioritizes persisted status for immediate display, then on-chain status
 */
const getStatusDisplay = (
  order: ClaimableOrder,
  isLoadingStatuses: boolean,
): { text: string; className: string; isLoading: boolean } => {
  // Show loading spinner only if we haven't fetched status yet and don't have a persisted ready status
  if (isLoadingStatuses && order.onChainStatus === null && order.status !== 'ready_to_claim') {
    return { text: '', className: 'status-checking', isLoading: true };
  }

  // Error fetching on-chain status
  if (order.onChainStatus === -1) {
    return { text: 'Error', className: 'status-error', isLoading: false };
  }

  // Ready to claim (from persisted status or on-chain confirmation)
  if (order.isClaimable) {
    return { text: 'Ready to claim', className: 'status-ready', isLoading: false };
  }

  // If on-chain status hasn't been fetched yet, show based on persisted status
  if (order.onChainStatus === null || order.onChainStatus === 0) {
    // Use persisted status if available
    if (order.status === 'open') {
      return { text: 'Waiting for filler', className: 'status-waiting', isLoading: false };
    }
    return { text: 'Pending', className: 'status-pending', isLoading: false };
  }

  // Map on-chain status to display text
  switch (order.onChainStatus) {
    case 1:
      return { text: 'Waiting for filler', className: 'status-waiting', isLoading: false };
    case 2:
      return { text: 'Filled (public)', className: 'status-filled', isLoading: false };
    case 3:
      return { text: 'Ready to claim', className: 'status-ready', isLoading: false };
    case 4:
      return { text: 'Already claimed', className: 'status-claimed', isLoading: false };
    case 5:
      return { text: 'Refunded', className: 'status-refunded', isLoading: false };
    default:
      return { text: 'Pending', className: 'status-pending', isLoading: false };
  }
};

export const PendingClaimsTable: React.FC<PendingClaimsTableProps> = ({
  aztecWallet,
  bridgeService,
}) => {
  const { claimableOrders, isLoadingStatuses, claimingOrderIds, claimOrder, refreshStatuses } = useClaimableOrders({
    aztecWallet,
    bridgeService,
  });

  if (claimableOrders.length === 0) {
    return null;
  }

  return (
    <div className="pending-claims-section">
      <div className="pending-claims-header">
        <h4 className="pending-claims-title">Pending Claims</h4>
        <span className="pending-claims-count">{claimableOrders.length}</span>
        <button
          className="refresh-status-button"
          onClick={refreshStatuses}
          disabled={isLoadingStatuses || !bridgeService}
          title="Refresh status"
        >
          {isLoadingStatuses ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="pending-claims-table-wrapper">
        <table className="pending-claims-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {claimableOrders.map((order) => {
              const isClaiming = claimingOrderIds.has(order.orderId);
              const statusDisplay = getStatusDisplay(order, isLoadingStatuses);

              return (
                <tr key={order.orderId}>
                  <td className="order-id-cell" title={order.orderId}>
                    {truncateOrderId(order.orderId)}
                  </td>
                  <td className="amount-cell">
                    {order.decodedAmount ?? 'Unknown'}
                  </td>
                  <td>
                    <span className={`status-badge ${statusDisplay.className}`}>
                      {statusDisplay.isLoading ? (
                        <span className="status-spinner" />
                      ) : (
                        statusDisplay.text
                      )}
                    </span>
                  </td>
                  <td className="created-cell">
                    {formatRelativeTime(order.createdAt)}
                  </td>
                  <td>
                    <button
                      className="claim-button"
                      onClick={() => claimOrder(order.orderId)}
                      disabled={!order.isClaimable || isClaiming || !bridgeService}
                    >
                      {isClaiming ? 'Claiming...' : 'Claim Privately'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

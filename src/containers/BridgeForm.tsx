import React, { useState, useEffect } from 'react';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { useWethBalance } from '../hooks/useWethBalance';
import { useEvmWethBalance } from '../hooks/useEvmWethBalance';
import { useBridgeOut } from '../hooks/useBridgeOut';
import { useBridgeIn } from '../hooks/useBridgeIn';
import { formatUnits } from 'viem';
import { AZTEC_WETH, BASE_SEPOLIA_WETH } from '../config';
import { AddressInputModal, AddressSelector } from '../components';

import {
  BridgeDirection,
  type PendingClaimStatus,
  type OrderStatus,
} from '../types';
import { PendingClaimsTable } from '../components/PendingClaimsTable';

type StepState = 'pending' | 'active' | 'complete' | 'error';

interface BridgeInStep {
  key: string;
  title: string;
  description: string;
  state: StepState;
}

interface BuildBridgeStepsArgs {
  isBridging: boolean;
  orderStatus?: OrderStatus | null;
  pendingClaimStatus?: PendingClaimStatus | null;
  hasError: boolean;
}

interface StepCopy {
  pendingTitle: string;
  doneTitle: string;
  pendingDescription: string;
  doneDescription: string;
}

const computeBridgeInSteps = ({
  isBridging,
  orderStatus,
  pendingClaimStatus,
  hasError,
}: BuildBridgeStepsArgs): BridgeInStep[] => {
  const statusValue = orderStatus?.status;
  const openedStatuses = new Set([
    'opened',
    'filled',
    'proving',
    'claiming',
    'claimed',
  ]);
  const filledStatuses = new Set(['filled', 'proving', 'claiming', 'claimed']);
  const hasPendingRecord =
    pendingClaimStatus === 'open' || pendingClaimStatus === 'ready_to_claim';
  const hasOrderOpened =
    openedStatuses.has(statusValue ?? '') || hasPendingRecord;
  const hasOrderFilled =
    filledStatuses.has(statusValue ?? '') ||
    pendingClaimStatus === 'ready_to_claim';
  const isProving = statusValue === 'proving';
  const isClaiming = statusValue === 'claiming';
  const isClaimed = statusValue === 'claimed';
  const proofComplete = isClaiming || isClaimed;

  const createStep = (
    key: string,
    state: StepState,
    copy: StepCopy
  ): BridgeInStep => {
    const isComplete = state === 'complete';
    return {
      key,
      state,
      title: isComplete ? copy.doneTitle : copy.pendingTitle,
      description: isComplete ? copy.doneDescription : copy.pendingDescription,
    };
  };

  const stepState = (complete: boolean, active: boolean): StepState => {
    if (complete) {
      return 'complete';
    }
    if (active) {
      return 'active';
    }
    return 'pending';
  };

  const steps: BridgeInStep[] = [
    createStep(
      'submit',
      stepState(hasOrderOpened, isBridging || statusValue === 'pending'),
      {
        pendingTitle: 'Send Base Sepolia transaction',
        doneTitle: 'Sent tokens on Base Sepolia',
        pendingDescription: 'Submitting bridge order on Base',
        doneDescription: 'Submitted bridge order on Base',
      }
    ),
    createStep(
      'wait-filler',
      stepState(hasOrderFilled, hasOrderOpened && !hasOrderFilled),
      {
        pendingTitle: 'Waiting for filler pickup',
        doneTitle: 'Filler picked up the transaction',
        pendingDescription: 'Relayer monitors and fills your order',
        doneDescription: 'Order filled and funds locked in the Aztec gateway',
      }
    ),
    createStep(
      'proof',
      stepState(proofComplete, isProving || (hasOrderFilled && !proofComplete)),
      {
        pendingTitle: 'Generate claim proof',
        doneTitle: 'Generated claim proof',
        pendingDescription: 'Preparing private claim inputs on Aztec',
        doneDescription: 'Proof ready for claim submission',
      }
    ),
    createStep(
      'claim-final',
      stepState(isClaimed, isClaiming || (proofComplete && !isClaimed)),
      {
        pendingTitle: 'Claiming tokens on Aztec',
        doneTitle: 'Claimed tokens on Aztec',
        pendingDescription:
          'Submitting claim_private and making WETH available privately',
        doneDescription: 'Private WETH now available in your Aztec wallet',
      }
    ),
  ];

  if (hasError) {
    const erroredStepIndex = steps.findIndex(
      (step) => step.state !== 'complete'
    );
    if (erroredStepIndex !== -1) {
      steps[erroredStepIndex] = {
        ...steps[erroredStepIndex],
        state: 'error',
      };
    }
  }

  return steps;
};

interface BridgeFormProps {
  direction: BridgeDirection;
}

export const BridgeForm: React.FC<BridgeFormProps> = ({ direction }) => {
  const {
    account: evmAccount,
    connect: connectEVM,
    disconnect: disconnectEVM,
    isSupported,
  } = useEVMWallet();
  const {
    connectedAccount: aztecAccount,
    createAccount,
    wallet: aztecWallet,
    bridgeService,
  } = useAztecWallet();

  // Aztec token balance (for bridge out - uses AZTEC_WETH)
  const {
    wethBalance: aztecTokenBalance,
    isLoading: isLoadingAztecBalance,
    refetch: refetchAztecBalance,
  } = useWethBalance();

  // EVM WETH balance (for bridge in)
  const {
    balance: evmWethBalance,
    isLoading: isLoadingEvmWeth,
    refetch: refetchEvmWeth,
  } = useEvmWethBalance();

  const [amount, setAmount] = useState('');

  // State for custom recipient address in Bridge Out
  const [customRecipientAddress, setCustomRecipientAddress] = useState<
    string | null
  >(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  // State for wallet modal in Bridge In (to manage EVM wallet connection)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Clear custom address if it matches the connected wallet address
  useEffect(() => {
    if (
      customRecipientAddress &&
      evmAccount?.address &&
      customRecipientAddress.toLowerCase() === evmAccount.address.toLowerCase()
    ) {
      setCustomRecipientAddress(null);
    }
  }, [customRecipientAddress, evmAccount?.address]);

  const {
    bridgeOut,
    isBridging: isBridgingOut,
    error: bridgeOutError,
    orderStatus: bridgeOutStatus,
    clearError: clearBridgeOutError,
  } = useBridgeOut({
    onSuccess: async () => {
      setAmount('');
      await refetchAztecBalance();
    },
  });

  const {
    bridgeIn,
    isBridging: isBridgingIn,
    error: bridgeInError,
    orderStatus: bridgeInStatus,
    clearError: clearBridgeInError,
    activeOrderId,
    activePendingClaim,
  } = useBridgeIn({
    onSuccess: async () => {
      setAmount('');
      await refetchEvmWeth();
    },
  });

  // Use the appropriate state based on direction
  const isBridging = direction === 'out' ? isBridgingOut : isBridgingIn;
  const error = direction === 'out' ? bridgeOutError : bridgeInError;
  const orderStatus = direction === 'out' ? bridgeOutStatus : bridgeInStatus;
  const clearError =
    direction === 'out' ? clearBridgeOutError : clearBridgeInError;

  const sourceBalance =
    direction === 'out' ? (aztecTokenBalance ?? 0n) : evmWethBalance;
  const isLoadingBalance =
    direction === 'out' ? isLoadingAztecBalance : isLoadingEvmWeth;
  const formattedBalance = formatUnits(sourceBalance, 18);

  // Recipient address for Bridge Out: custom address takes priority over connected wallet
  const bridgeOutRecipient = customRecipientAddress || evmAccount?.address;

  // Configuration based on direction
  const config = {
    out: {
      title: 'Bridge Out',
      subtitle: 'Transfer WETH from Aztec to Base Sepolia',
      fromNetwork: 'Aztec Devnet',
      toNetwork: 'Base Sepolia',
      fromAddress: aztecAccount?.getAddress().toString(),
      toAddress: bridgeOutRecipient,
      balanceLabel: 'Available Private Balance',
      buttonText: 'Bridge to Base Sepolia',
      tokenAddress: AZTEC_WETH,
    },
    in: {
      title: 'Bridge In',
      subtitle: 'Transfer WETH from Base Sepolia to Aztec',
      fromNetwork: 'Base Sepolia',
      toNetwork: 'Aztec Devnet',
      fromAddress: evmAccount?.address,
      toAddress: aztecAccount?.getAddress().toString(),
      balanceLabel: 'Available WETH Balance',
      buttonText: 'Bridge to Aztec',
      tokenAddress: BASE_SEPOLIA_WETH,
    },
  };

  const currentConfig = config[direction];

  // Computed variables for addresses
  const truncatedFromAddress = currentConfig.fromAddress
    ? `${currentConfig.fromAddress.slice(0, 8)}...${currentConfig.fromAddress.slice(-6)}`
    : '';
  const truncatedToAddress = currentConfig.toAddress
    ? `${currentConfig.toAddress.slice(0, 8)}...${currentConfig.toAddress.slice(-6)}`
    : '';
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
      if (!bridgeOutRecipient) {
        return;
      }
      await bridgeOut(amount, sourceBalance, bridgeOutRecipient);
    } else {
      await bridgeIn(amount, sourceBalance);
    }
  };

  const handleConnectAztec = async () => {
    try {
      await createAccount();
    } catch (error) {
      console.error('Failed to connect Aztec wallet:', error);
    }
  };

  // Connection requirements differ by direction
  // Bridge Out: needs Aztec wallet + recipient address (can be pasted or from connected wallet)
  // Bridge In: needs both wallets connected (EVM must sign)
  const isConnected =
    direction === 'out'
      ? aztecAccount && Boolean(bridgeOutRecipient)
      : evmAccount?.isConnected && aztecAccount;

  // For showing balance, we only need the source wallet connected
  const hasSourceWallet =
    direction === 'out'
      ? Boolean(aztecAccount)
      : Boolean(evmAccount?.isConnected);

  const canBridge =
    isConnected && amount && !isBridging && parseFloat(amount) > 0;

  const getButtonText = (): string => {
    if (isBridging) return 'Processing...';
    if (!aztecAccount) return 'Connect Aztec Wallet';
    if (direction === 'out' && !bridgeOutRecipient) return 'Select Recipient';
    if (direction === 'in' && !evmAccount?.isConnected)
      return 'Connect EVM Wallet';
    return currentConfig.buttonText;
  };

  return (
    <div className="bridge-form">
      <div className="bridge-header">
        <h2 className="bridge-title">
          <span className="bridge-icon">
            {direction === 'out' ? '🌉' : '🌈'}
          </span>
          {currentConfig.title}
        </h2>
        <p className="bridge-subtitle">{currentConfig.subtitle}</p>
      </div>

      {direction === 'in' && (
        <PendingClaimsTable
          aztecWallet={aztecWallet}
          bridgeService={bridgeService}
        />
      )}

      <div className="bridge-route">
        <div className="route-endpoint">
          <span className="route-label">From</span>
          <div className="route-network">{currentConfig.fromNetwork}</div>
          {/* Bridge Out: show static Aztec address or connect button */}
          {direction === 'out' && currentConfig.fromAddress && (
            <div className="route-address" title={currentConfig.fromAddress}>
              {truncatedFromAddress}
            </div>
          )}
          {direction === 'out' && !currentConfig.fromAddress && (
            <button
              className="connect-aztec-button"
              onClick={handleConnectAztec}
            >
              Connect Aztec Wallet
            </button>
          )}
          {/* Bridge In: use address selector for EVM wallet management */}
          {direction === 'in' && (
            <AddressSelector
              address={evmAccount?.address}
              placeholder="Connect EVM Wallet"
              onClick={() => setIsWalletModalOpen(true)}
              disabled={isBridging}
            />
          )}
        </div>
        <div className="route-arrow">→</div>
        <div className="route-endpoint">
          <span className="route-label">To</span>
          <div className="route-network">{currentConfig.toNetwork}</div>
          {/* Bridge Out: Use address selector for recipient (can paste or connect) */}
          {direction === 'out' && (
            <AddressSelector
              address={bridgeOutRecipient}
              placeholder="Enter recipient address"
              onClick={() => setIsAddressModalOpen(true)}
              disabled={isBridging}
            />
          )}
          {/* Bridge In with address: show static address */}
          {direction === 'in' && currentConfig.toAddress && (
            <div className="route-address" title={currentConfig.toAddress}>
              {truncatedToAddress}
            </div>
          )}
          {/* Bridge In without address: show connect button */}
          {direction === 'in' && !currentConfig.toAddress && (
            <button
              className="connect-aztec-button"
              onClick={handleConnectAztec}
            >
              Connect Aztec Wallet
            </button>
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
        {hasSourceWallet && (
          <div className="balance-info">
            <div className="balance-label">{currentConfig.balanceLabel}</div>
            {isLoadingBalance && <div className="balance-loading-value" />}
            {!isLoadingBalance && (
              <div className="balance-value">{formattedBalance} WETH</div>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-message">⚠️ {error}</div>}

      {direction === 'out' &&
        orderStatus &&
        orderStatus.status !== 'failed' && (
          <div className="order-status">
            <div className="status-label">Order Status</div>
            <div className="status-value">
              {orderStatus.status === 'pending' && '⏳ Creating order...'}
              {orderStatus.status === 'opened' &&
                '📝 Order opened, waiting for filler...'}
              {orderStatus.status === 'filled' && '✅ Bridge completed!'}
            </div>
            {orderStatus.orderId && (
              <div className="order-id">
                Order ID: {orderStatus.orderId.slice(0, 10)}...
              </div>
            )}
          </div>
        )}

      {direction === 'in' &&
        (isBridgingIn || bridgeInStatus || activePendingClaim) && (
          <div
            className={`bridge-progress ${
              bridgeInStatus?.status === 'claimed' ? 'success' : ''
            }`}
          >
            <div className="bridge-progress-header">
              <div className="bridge-progress-title">Bridge status</div>
              {activeOrderId && (
                <div className="bridge-progress-order">
                  Order {activeOrderId.slice(0, 8)}...{activeOrderId.slice(-6)}
                </div>
              )}
            </div>
            <div className="bridge-steps">
              {computeBridgeInSteps({
                isBridging: isBridgingIn,
                orderStatus: bridgeInStatus,
                pendingClaimStatus: activePendingClaim?.status,
                hasError: Boolean(bridgeInError),
              }).map((step) => (
                <div
                  key={step.key}
                  className={`bridge-step ${step.state} ${
                    step.key === 'claim-final' && step.state === 'complete'
                      ? 'success'
                      : ''
                  }`}
                >
                  <div className="bridge-step-bullet" />
                  <div className="bridge-step-content">
                    <div className="bridge-step-title">{step.title}</div>
                    <div className="bridge-step-description">
                      {step.description}
                    </div>
                  </div>
                  {step.key === 'claim-final' && step.state === 'complete' && (
                    <div className="bridge-step-confetti" aria-hidden="true">
                      🎉
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      <button
        className="bridge-button"
        onClick={handleBridge}
        disabled={!canBridge}
      >
        {getButtonText()}
      </button>

      {direction === 'in' && !isSupported && (
        <div className="error-message">
          ⚠️ Please switch to Base Sepolia network
        </div>
      )}

      {/* Address selection modal for Bridge Out recipient */}
      <AddressInputModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onConfirm={(address) => setCustomRecipientAddress(address)}
        onConnectWallet={connectEVM}
        onDisconnectWallet={disconnectEVM}
        customAddress={customRecipientAddress}
        isWalletConnected={evmAccount?.isConnected}
        connectedWalletAddress={evmAccount?.address}
      />

      {/* Wallet connection modal for Bridge In source */}
      <AddressInputModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConfirm={() => setIsWalletModalOpen(false)}
        onConnectWallet={connectEVM}
        onDisconnectWallet={disconnectEVM}
        isWalletConnected={evmAccount?.isConnected}
        connectedWalletAddress={evmAccount?.address}
        title="Manage Wallet Connection"
        showManualInput={false}
      />
    </div>
  );
};

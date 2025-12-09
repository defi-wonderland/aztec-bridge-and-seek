import { useConfig } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { useAztecWallet } from './context/useAztecWallet';
import { useMemo } from 'react';
import { EVMBridgeService } from '../services/evm/features/EVMBridgeService';
import { Fr } from '@aztec/foundation/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import bridgeSwapHookAbi from '../abi/bridgeSwapHook.json';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BRIDGE_SWAP_HOOK_ADDRESS,
  BRIDGE_SWAP_RECIPIENT,
} from '../config';
import { SetFlowStepOptions, SwapStep } from './swap/useSwapFlow';

export type UseBridgeSwapOptions = {
  onSuccess?: () => void | Promise<void>;
};

export type SwapParams = {
  amount: bigint;
  setFlowStep: (step: SwapStep, options?: SetFlowStepOptions) => void;
  onError: (step: SwapStep) => void;
};

export const useBridgeSwap = (options?: UseBridgeSwapOptions) => {
  const wagmiConfig = useConfig();
  const { wallet: aztecWallet, bridgeService } = useAztecWallet();

  const isReady = Boolean(aztecWallet && bridgeService);

  // Create bridge service instance
  const bridgeServiceEvm = useMemo(() => {
    if (!isReady || !aztecWallet || !bridgeService) {
      return null;
    }

    return new EVMBridgeService(wagmiConfig, aztecWallet, bridgeService);
  }, [wagmiConfig, aztecWallet, bridgeService, isReady]);

  const swap = async ({ amount, setFlowStep, onError }: SwapParams) => {
    // Track current step for error reporting
    let currentStep: SwapStep = 1;

    try {
      // Generate a random nonce for the order
      const nonce = Fr.random();
      const secret = Fr.random();
      const secretHash = await poseidon2Hash([secret]);

      console.log('Initiating bridge: swap');

      if (!isReady || !bridgeServiceEvm || !aztecWallet) {
        throw new Error(
          'Bridge service not ready. Connect Aztec & EVM wallets before swapping.'
        );
      }

      // Step 1: Bridge out from Aztec to EVM
      const resultBridgeOut =
        await bridgeService.openAztecToEvmOrderForBridgeSwap({
          confidential: true, // Always use private balance
          sourceAmount: amount,
          targetAmount: amount, // 1:1 for WETH bridge
          recipientAddress: BRIDGE_SWAP_RECIPIENT,
          secretHash: secretHash,
          nonce,
          callbacks: {
            onOrderOpened: (orderId: string, txHash: string) => {
              console.log('Order opened:', { orderId, txHash });
              // Step 1 completed (bridge out) → advance to step 2 and record hash
              setFlowStep(2, { txHash });
              currentStep = 2;
            },
            onOrderFilled: (orderId: string, fillTxHash: string) => {
              console.log('Order filled:', { orderId, fillTxHash });
            },
            onStatusUpdate: (status: any) => {
              console.log('Status update:', status);
            },
            onError: (error: Error) => {
              console.error('Bridge error:', error);
            },
          },
        });

      const bridgeOutOrderId = resultBridgeOut.orderId;
      if (!bridgeOutOrderId) {
        throw new Error('Bridge out order id not found.');
      }

      console.log('Bridge out order id: ', bridgeOutOrderId);

      const normalizedBridgeOutOrderId = bridgeOutOrderId.startsWith('0x')
        ? bridgeOutOrderId
        : `0x${bridgeOutOrderId}`;

      console.log(
        'Normalized bridge out order id: ',
        normalizedBridgeOutOrderId
      );

      // Step 2: Wait for hook to process and get swap tx
      const hookOrderId = await fetchHookOrderIdWithRetries(
        normalizedBridgeOutOrderId,
        wagmiConfig
      );

      // Get the swap txHash from Base Sepolia gateway logs
      const swapTxHash = await bridgeServiceEvm.getSwapTxHash(hookOrderId);
      console.log('Swap txHash:', swapTxHash);

      // Step 2 completed (swap) → advance to step 3 and record swap hash
      setFlowStep(3, { txHash: swapTxHash, hashStep: 2 });
      currentStep = 3;

      // Step 3 & 4: Bridge back to Aztec and claim
      const resultBridgeIn =
        await bridgeServiceEvm.openEvmToAztecOrderForBridgeSwap({
          orderId: hookOrderId,
          secret,
          onFilledLogFound: (bridgeInTxHash?: string) => {
            // Step 3 completed (bridge in) → advance to step 4 and record bridge in hash in slot 3
            setFlowStep(4, { txHash: bridgeInTxHash, hashStep: 3 });
            currentStep = 4;
          },
          onClaimed: (claimTxHash: string) => {
            // Final step completed → advance to 5 and record claim hash in slot 4
            setFlowStep(5, { txHash: claimTxHash, hashStep: 4 });
          },
        });

      console.log('Result for bridge in: ', resultBridgeIn);
      console.log('CONGRATS! Bridge swap completed successfully');

      // Notify caller that swap completed successfully
      await options?.onSuccess?.();
    } catch (error) {
      console.error('swap error:', error);
      onError(currentStep);
    }
  };

  return {
    swap,
    isReady,
  };
};

const fetchHookOrderIdWithRetries = async (
  orderId: string,
  config: ReturnType<typeof useConfig>
) => {
  const maxAttempts = 40;
  const delayMs = 3000;
  const zeroHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hookOrderId = (await readContract(config, {
      address: BRIDGE_SWAP_HOOK_ADDRESS as `0x${string}`,
      abi: bridgeSwapHookAbi,
      functionName: 'orderIdMapping',
      args: [orderId as `0x${string}`],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    })) as `0x${string}`;

    console.log(`Hook order id (attempt ${attempt}):`, hookOrderId);

    if (hookOrderId && hookOrderId !== zeroHash) {
      return hookOrderId;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unable to resolve bridge out order id from hook.');
};

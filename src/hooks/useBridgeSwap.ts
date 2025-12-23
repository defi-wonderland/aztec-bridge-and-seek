import { useConfig, type Config } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { useAztecWallet } from './context/useAztecWallet';
import { useMemo } from 'react';
import { DEVNET_CONFIG } from '../config/networks/devnet';
import { EVMBridgeService } from '../services/evm/features/EVMBridgeService';
import { Fr } from '@aztec/aztec.js/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import bridgeSwapHookAbi from '../abi/bridgeSwapHook.json';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BRIDGE_SWAP_HOOK_ADDRESS,
  BRIDGE_SWAP_RECIPIENT,
  AZTEC_WETH,
} from '../config';
import { SWAP_STEPS, ActiveSwapStep } from '../components/swap/constants';
import { SetFlowStepOptions, SwapStep } from './swap/useSwapFlow';

export type UseBridgeSwapOptions = {
  onSuccess?: () => void | Promise<void>;
};

export type SwapParams = {
  amount: bigint;
  setFlowStep: (step: SwapStep, options?: SetFlowStepOptions) => void;
  onError: (step: ActiveSwapStep) => void;
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
    // Track current step for error reporting (only active steps can error)
    let currentStep: ActiveSwapStep = SWAP_STEPS.BRIDGE_OUT;

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
          swapTokenAddress: AZTEC_WETH.toString(),
          nonce,
          callbacks: {
            onOrderOpened: (orderId: string, txHash: string) => {
              console.log('Order opened:', { orderId, txHash });
              // Bridge out completed → advance to swap step and record hash
              setFlowStep(SWAP_STEPS.SWAP, { txHash });
              currentStep = SWAP_STEPS.SWAP;
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

      // Swap completed → advance to bridge in step and record swap hash
      setFlowStep(SWAP_STEPS.BRIDGE_IN, {
        txHash: swapTxHash,
        hashStep: SWAP_STEPS.SWAP,
      });
      currentStep = SWAP_STEPS.BRIDGE_IN;

      // Step 3 & 4: Bridge back to Aztec and claim
      const resultBridgeIn =
        await bridgeServiceEvm.openEvmToAztecOrderForBridgeSwap({
          orderId: hookOrderId,
          secret,
          onFilledLogFound: (bridgeInTxHash?: string) => {
            // Bridge in completed → advance to claim step and record bridge in hash
            setFlowStep(SWAP_STEPS.CLAIM, {
              txHash: bridgeInTxHash,
              hashStep: SWAP_STEPS.BRIDGE_IN,
            });
            currentStep = SWAP_STEPS.CLAIM;
          },
          onClaimed: (claimTxHash: string) => {
            // Final step completed → advance to completed and record claim hash
            setFlowStep(SWAP_STEPS.COMPLETED, {
              txHash: claimTxHash,
              hashStep: SWAP_STEPS.CLAIM,
            });
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

const fetchHookOrderIdWithRetries = async (orderId: string, config: Config) => {
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

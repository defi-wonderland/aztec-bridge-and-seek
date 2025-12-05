import { useConfig } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { useEVMWallet } from './context/useEVMWallet';
import { useAztecWallet } from './context/useAztecWallet';
import { useMemo } from 'react';
import { EVMBridgeService } from '../services/evm/features/EVMBridgeService';
import { parseUnits, createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { Fr } from '@aztec/foundation/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import bridgeSwapHookAbi from '../abi/bridgeSwapHook.json';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BRIDGE_SWAP_HOOK_ADDRESS,
  BASE_SEPOLIA_GATEWAY,
} from '../config';
import { SetFlowStepOptions, SwapStep } from './swap/useSwapFlow';

export const useBridgeSwap = () => {
  const wagmiConfig = useConfig();
  const { account: evmAccount } = useEVMWallet();
  const { wallet: aztecWallet, bridgeService } = useAztecWallet();

  const isReady = Boolean(aztecWallet && bridgeService);

  // Create bridge service instance
  const bridgeServiceEvm = useMemo(() => {
    if (!isReady || !aztecWallet || !bridgeService) {
      return null;
    }

    return new EVMBridgeService(wagmiConfig, aztecWallet, bridgeService);
  }, [wagmiConfig, aztecWallet, bridgeService, isReady]);

  const swap = async (
    setFlowStep: (step: SwapStep, options?: SetFlowStepOptions) => void
  ) => {
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

      const amountWei = parseUnits('0.000000000000000001', 18);

      const recipient = '0xf123A8715A645f902717EC71C239F96Bc7A312D5';

      // Call bridge service to open order to bridge out and swap
      const resultBridgeOut =
        await bridgeService.openAztecToEvmOrderForBridgeSwap({
          confidential: true, // Always use private balance
          sourceAmount: amountWei,
          targetAmount: amountWei, // 1:1 for WETH bridge
          recipientAddress: recipient,
          secretHash: secretHash,
          nonce,
          callbacks: {
            onOrderOpened: (orderId: string, txHash: string) => {
              console.log('Order opened:', { orderId, txHash });
              // Step 1 completed (bridge out) → advance to step 2 and record hash
              setFlowStep(2, { txHash });
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

      const hookOrderId = await fetchHookOrderIdWithRetries(
        normalizedBridgeOutOrderId,
        wagmiConfig
      );

      // Get the swap txHash from Base Sepolia gateway logs
      const swapTxHash = await fetchSwapTxHash(hookOrderId);
      console.log('Swap txHash:', swapTxHash);

      // Step 2 completed (swap) → advance to step 3 and record swap hash
      setFlowStep(3, { txHash: swapTxHash, hashStep: 2 });

      const resultBridgeIn =
        await bridgeServiceEvm.openEvmToAztecOrderForBridgeSwap({
          orderId: hookOrderId,
          secret,
          onFilledLogFound: (bridgeInTxHash?: string) => {
            // Step 3 completed (bridge in) → advance to step 4 and record bridge in hash in slot 3
            setFlowStep(4, { txHash: bridgeInTxHash, hashStep: 3 });
          },
          onClaimed: (claimTxHash: string) => {
            // Final step completed → advance to 5 and record claim hash in slot 4
            setFlowStep(5, { txHash: claimTxHash, hashStep: 4 });
          },
        });

      console.log('Result for bridge in: ', resultBridgeIn);
      console.log('CONGRATS! Bridge swap completed successfully');
    } catch (error) {
      console.error('swap error:', error);
      throw error;
    }
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

  /**
   * Fetch the swap transaction hash from Base Sepolia gateway logs.
   * The hook emits an Open event when it opens the return order after the swap.
   */
  const fetchSwapTxHash = async (
    hookOrderId: string
  ): Promise<string | undefined> => {
    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Get current block and search last ~500 blocks (swap just happened)
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 500n ? currentBlock - 500n : 0n;

      // Event signature for Open
      const openEventAbi = parseAbiItem(
        'event Open(bytes32 indexed orderId, (address user, uint256 originChainId, uint32 openDeadline, uint32 fillDeadline, bytes32 orderId, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] maxSpent, (bytes32 token, uint256 amount, bytes32 recipient, uint256 chainId)[] minReceived, (uint256 destinationChainId, bytes32 destinationSettler, bytes originData)[] fillInstructions) resolvedOrder)'
      );

      const logs = await publicClient.getLogs({
        address: BASE_SEPOLIA_GATEWAY as `0x${string}`,
        event: openEventAbi,
        args: {
          orderId: hookOrderId as `0x${string}`,
        },
        fromBlock,
        toBlock: 'latest',
      });

      if (logs.length > 0) {
        return logs[0].transactionHash;
      }

      console.warn('No Open event found for hookOrderId:', hookOrderId);
      return undefined;
    } catch (error) {
      console.error('Failed to fetch swap txHash:', error);
      return undefined;
    }
  };

  return {
    swap,
    isReady,
  };
};

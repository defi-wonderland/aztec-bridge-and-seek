/**
 * Swap Steps
 * Named constants for swap flow steps (avoids magic numbers)
 */
export const SWAP_STEPS = {
  IDLE: 0,
  BRIDGE_OUT: 1,
  SWAP: 2,
  BRIDGE_IN: 3,
  CLAIM: 4,
  COMPLETED: 5,
} as const;

export type SwapStep = (typeof SWAP_STEPS)[keyof typeof SWAP_STEPS];

/**
 * Active steps (steps where work is being done, errors can occur)
 * Excludes IDLE and COMPLETED
 */
export type ActiveSwapStep =
  | typeof SWAP_STEPS.BRIDGE_OUT
  | typeof SWAP_STEPS.SWAP
  | typeof SWAP_STEPS.BRIDGE_IN
  | typeof SWAP_STEPS.CLAIM;

/**
 * Swap Progress Step Labels
 * Configuration for step titles in different states
 */
export type StepLabelConfig = {
  active: string;
  completed: string;
  error: string;
};

export type StepLabelsConfig = {
  bridgeOut: StepLabelConfig;
  swap: StepLabelConfig;
  bridgeIn: StepLabelConfig;
  claim: StepLabelConfig;
};

/**
 * Step labels - short and descriptive
 */
export const STEP_LABELS: StepLabelsConfig = {
  bridgeOut: {
    active: 'Bridging to Base',
    completed: 'Bridged to Base',
    error: 'Bridge failed',
  },
  swap: {
    active: 'Swapping on Base',
    completed: 'Swapped on Base',
    error: 'Swap failed',
  },
  bridgeIn: {
    active: 'Bridging to Aztec',
    completed: 'Bridged to Aztec',
    error: 'Bridge failed',
  },
  claim: {
    active: 'Claiming on Aztec',
    completed: 'Claimed on Aztec',
    error: 'Claim failed',
  },
};

export type SummaryStatus = 'pending' | 'completed' | 'error';

/**
 * Slippage Tolerance Presets (in percentage)
 *
 * These values represent common slippage tolerances for DEX swaps:
 * - 1%: Conservative - may fail during high volatility
 * - 3%: Moderate - balanced between execution and price protection
 * - 5%: Default - recommended for cross-chain swaps with multiple hops
 */
export const SLIPPAGE_PRESETS = [1, 3, 5] as const;
/** Numeric slippage preset values (1, 3, 5) */
export type SlippagePresetValue = (typeof SLIPPAGE_PRESETS)[number];
/** Slippage preset including 'custom' option */
export type SlippagePreset = SlippagePresetValue | 'custom';
export const DEFAULT_SLIPPAGE: SlippagePresetValue = 5;

/**
 * Get summary status based on step and error
 */
export const getSummaryStatus = (
  step: SwapStep,
  errorStep?: SwapStep | null
): SummaryStatus => {
  if (errorStep) return 'error';
  if (step === SWAP_STEPS.COMPLETED) return 'completed';
  return 'pending';
};

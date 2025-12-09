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
 * Get summary status based on step and error
 */
export const getSummaryStatus = (
  step: number,
  errorStep?: number | null
): SummaryStatus => {
  if (errorStep) return 'error';
  if (step === 5) return 'completed';
  return 'pending';
};

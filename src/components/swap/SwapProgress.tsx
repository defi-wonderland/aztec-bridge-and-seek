import React from 'react';
import {
  STEP_LABELS,
  StepLabelsConfig,
  getSummaryStatus,
  SWAP_STEPS,
  SwapStep,
  ActiveSwapStep,
} from './constants';
import { AZTEC_EXPLORER_URL, BASE_EXPLORER_URL } from '../../config';
import { formatDisplayAmount } from '../../utils/format';
import { Tooltip } from '../Tooltip';

type StepState = 'pending' | 'active' | 'completed' | 'error';

export type SwapProgressProps = {
  amountFrom: string;
  tokenFrom: string;
  amountTo: string;
  tokenTo: string;
  /** Current active step (COMPLETED = all done) */
  step: SwapStep;
  /** Step where error occurred (only active steps can error) */
  errorStep?: ActiveSwapStep | null;
  txHashes?: {
    bridgeOut?: string;
    swap?: string;
    bridgeIn?: string;
    claim?: string;
  };
};

function getStepState(
  currentStep: SwapStep,
  targetStep: SwapStep,
  errorStep?: SwapStep | null
): StepState {
  // If this step has an error, show error state
  if (errorStep === targetStep) return 'error';
  // If error occurred before this step, stay pending
  if (errorStep && errorStep < targetStep) return 'pending';
  // Normal flow
  if (currentStep > targetStep) return 'completed';
  if (currentStep === targetStep) return 'active';
  return 'pending';
}

export const SwapProgress: React.FC<SwapProgressProps> = ({
  amountFrom,
  tokenFrom,
  amountTo,
  tokenTo,
  step,
  errorStep,
  txHashes,
}) => {
  const s1 = getStepState(step, SWAP_STEPS.BRIDGE_OUT, errorStep);
  const s2 = getStepState(step, SWAP_STEPS.SWAP, errorStep);
  const s3 = getStepState(step, SWAP_STEPS.BRIDGE_IN, errorStep);
  const s4 = getStepState(step, SWAP_STEPS.CLAIM, errorStep);

  const getStepTitle = (
    key: keyof StepLabelsConfig,
    state: StepState
  ): string => {
    if (state === 'error') return STEP_LABELS[key].error;
    if (state === 'completed') return STEP_LABELS[key].completed;
    return STEP_LABELS[key].active;
  };

  // Format amounts for summary display
  const displayFrom = formatDisplayAmount(amountFrom);
  const displayTo = formatDisplayAmount(amountTo);
  const fullAmountFrom = `${amountFrom} ${tokenFrom}`;
  const fullAmountTo = `${amountTo} ${tokenTo}`;
  const summaryStatus = getSummaryStatus(step, errorStep);

  const Step = ({
    state,
    children,
  }: {
    state: StepState;
    children: React.ReactNode;
  }) => <div className={`swap-step ${state}`}>{children}</div>;

  const Connector = ({
    leftState,
    rightState,
  }: {
    leftState: StepState;
    rightState: StepState;
  }) => {
    // Connector reflects the state of the RIGHT step:
    // - completed: both sides completed
    // - active: left completed AND right is active (animating towards right)
    // - error: right has error (line leading TO the error)
    // - pending: right is still pending
    let connectorState: StepState = 'pending';
    if (rightState === 'error') {
      connectorState = 'error';
    } else if (leftState === 'completed' && rightState === 'completed') {
      connectorState = 'completed';
    } else if (leftState === 'completed' && rightState === 'active') {
      connectorState = 'active';
    }
    // If left is active but right is pending, connector stays pending
    return <div className={`swap-connector ${connectorState}`} />;
  };

  const buildTxLink = (base: string, hash?: string) => {
    if (!hash) return undefined;
    return `${base}${hash}`;
  };

  const renderTxLink = (state: StepState, url?: string) => {
    if (state !== 'completed' || !url) return null;
    return (
      <a className="swap-step-link" href={url} target="_blank" rel="noreferrer">
        View tx
      </a>
    );
  };

  return (
    <div className="swap-progress-container">
      {/* Summary header */}
      <div className={`swap-progress-summary ${summaryStatus}`}>
        <div className="swap-summary-token">
          <Tooltip content={fullAmountFrom}>
            <span className="swap-summary-amount">{displayFrom}</span>
          </Tooltip>
          <span className="swap-summary-symbol">{tokenFrom}</span>
        </div>
        <div className="swap-summary-divider">
          <div className="swap-summary-progress-track">
            <div
              className={`swap-summary-progress-fill ${summaryStatus}`}
              style={{
                width: `${Math.min((step / SWAP_STEPS.COMPLETED) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
        <div className="swap-summary-token">
          <Tooltip content={fullAmountTo}>
            <span className="swap-summary-amount">{displayTo}</span>
          </Tooltip>
          <span className="swap-summary-symbol">{tokenTo}</span>
        </div>
      </div>

      {/* Progress steps */}
      <div className="swap-progress">
        <Step state={s1}>
          <div className="swap-step-icon">🌉</div>
          <div className="swap-step-title">{getStepTitle('bridgeOut', s1)}</div>
          {renderTxLink(
            s1,
            buildTxLink(AZTEC_EXPLORER_URL, txHashes?.bridgeOut)
          )}
        </Step>
        <Connector leftState={s1} rightState={s2} />
        <Step state={s2}>
          <div className="swap-step-icon">🔁</div>
          <div className="swap-step-title">{getStepTitle('swap', s2)}</div>
          {renderTxLink(s2, buildTxLink(BASE_EXPLORER_URL, txHashes?.swap))}
        </Step>
        <Connector leftState={s2} rightState={s3} />
        <Step state={s3}>
          <div className="swap-step-icon">🏁</div>
          <div className="swap-step-title">{getStepTitle('bridgeIn', s3)}</div>
          {renderTxLink(
            s3,
            buildTxLink(AZTEC_EXPLORER_URL, txHashes?.bridgeIn)
          )}
        </Step>
        <Connector leftState={s3} rightState={s4} />
        <Step state={s4}>
          <div className="swap-step-icon">✅</div>
          <div className="swap-step-title">{getStepTitle('claim', s4)}</div>
          {renderTxLink(s4, buildTxLink(AZTEC_EXPLORER_URL, txHashes?.claim))}
        </Step>
      </div>
    </div>
  );
};

export default SwapProgress;

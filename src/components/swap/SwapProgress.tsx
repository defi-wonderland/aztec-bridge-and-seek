import React from 'react';

type StepState = 'pending' | 'active' | 'completed';

export type SwapProgressProps = {
  amountFrom: string;
  tokenFrom: string;
  amountTo: string;
  tokenTo: string;
  step: 1 | 2 | 3 | 4 | 5; // current active step (5 = all completed)
  txHashes?: {
    bridgeOut?: string;
    swap?: string;
    bridgeIn?: string;
    claim?: string;
  };
};

function getStepState(current: number, step: number): StepState {
  if (current > step) return 'completed';
  if (current === step) return 'active';
  return 'pending';
}

export const SwapProgress: React.FC<SwapProgressProps> = ({
  amountFrom,
  tokenFrom,
  amountTo,
  tokenTo,
  step,
  txHashes,
}) => {
  const s1 = getStepState(step, 1);
  const s2 = getStepState(step, 2);
  const s3 = getStepState(step, 3);
  const s4 = getStepState(step, 4);

  // Step labels configuration: active (in progress) vs completed (done)
  const stepLabels = {
    bridgeOut: {
      active: `Bridging ${amountFrom || '0'} ${tokenFrom} to Base Sepolia`,
      completed: `Bridged ${amountFrom || '0'} ${tokenFrom} to Base Sepolia`,
    },
    swap: {
      active: `Swapping to ${amountTo || '0'} ${tokenTo}`,
      completed: `Swapped to ${amountTo || '0'} ${tokenTo}`,
    },
    bridgeIn: {
      active: 'Bridging back to Aztec',
      completed: 'Bridged back to Aztec',
    },
    claim: {
      active: 'Claiming on Aztec',
      completed: 'Claimed on Aztec',
    },
  };

  const getStepTitle = (
    key: keyof typeof stepLabels,
    state: StepState
  ): string => {
    return state === 'completed'
      ? stepLabels[key].completed
      : stepLabels[key].active;
  };

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
    // - pending: right is still pending
    let connectorState: StepState = 'pending';
    if (leftState === 'completed' && rightState === 'completed') {
      connectorState = 'completed';
    } else if (leftState === 'completed' && rightState === 'active') {
      connectorState = 'active';
    }
    // If left is active but right is pending, connector stays pending
    return <div className={`swap-connector ${connectorState}`} />;
  };

  const aztecExplorer = 'https://devnet.aztecscan.xyz/tx-effects/';
  const baseExplorer = 'https://sepolia.basescan.org/tx/';

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
    <div className="swap-progress">
      <Step state={s1}>
        <div className="swap-step-icon">🌉</div>
        <div className="swap-step-title">{getStepTitle('bridgeOut', s1)}</div>
        {renderTxLink(s1, buildTxLink(aztecExplorer, txHashes?.bridgeOut))}
      </Step>
      <Connector leftState={s1} rightState={s2} />
      <Step state={s2}>
        <div className="swap-step-icon">🔁</div>
        <div className="swap-step-title">{getStepTitle('swap', s2)}</div>
        {renderTxLink(s2, buildTxLink(baseExplorer, txHashes?.swap))}
      </Step>
      <Connector leftState={s2} rightState={s3} />
      <Step state={s3}>
        <div className="swap-step-icon">🏁</div>
        <div className="swap-step-title">{getStepTitle('bridgeIn', s3)}</div>
        {renderTxLink(s3, buildTxLink(aztecExplorer, txHashes?.bridgeIn))}
      </Step>
      <Connector leftState={s3} rightState={s4} />
      <Step state={s4}>
        <div className="swap-step-icon">✅</div>
        <div className="swap-step-title">{getStepTitle('claim', s4)}</div>
        {renderTxLink(s4, buildTxLink(aztecExplorer, txHashes?.claim))}
      </Step>
    </div>
  );
};

export default SwapProgress;

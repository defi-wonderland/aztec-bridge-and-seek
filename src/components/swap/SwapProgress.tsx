import React from 'react';

type StepState = 'pending' | 'active' | 'completed';

export type SwapProgressProps = {
  amountFrom: string;
  tokenFrom: string;
  amountTo: string;
  tokenTo: string;
  step: 1 | 2 | 3; // current active step
  onClaim?: () => void;
  isClaimLoading?: boolean;
  explorerUrl?: string;
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
  onClaim,
  isClaimLoading,
  explorerUrl,
}) => {
  const s1 = getStepState(step, 1);
  const s2 = getStepState(step, 2);
  const s3 = getStepState(step, 3);

  const Step = ({
    state,
    children,
  }: {
    state: StepState;
    children: React.ReactNode;
  }) => <div className={`swap-step ${state}`}>{children}</div>;

  const Connector = ({ leftState }: { leftState: StepState }) => (
    <div
      className={`swap-connector ${leftState === 'completed' ? 'completed' : leftState === 'active' ? 'active' : 'pending'}`}
    />
  );

  const explorer = explorerUrl ?? 'https://sepolia.etherscan.io/';

  return (
    <div className="swap-progress">
      <Step state={s1}>
        <div className="swap-step-icon">🌉</div>
        <div className="swap-step-title">
          Bridging {amountFrom || '0'} {tokenFrom} to Base Sepolia
        </div>
        {s1 === 'completed' && (
          <a
            className="swap-step-link"
            href={explorer}
            target="_blank"
            rel="noreferrer"
          >
            tx hash
          </a>
        )}
      </Step>
      <Connector leftState={s1} />
      <Step state={s2}>
        <div className="swap-step-icon">🔁</div>
        <div className="swap-step-title">
          Swapping to {amountTo || '0'} {tokenTo}
        </div>
        {s2 === 'completed' && (
          <a
            className="swap-step-link"
            href={explorer}
            target="_blank"
            rel="noreferrer"
          >
            tx hash
          </a>
        )}
      </Step>
      <Connector leftState={s2} />
      <Step state={s3}>
        <div className="swap-step-icon">🏁</div>
        <div className="swap-step-title">Bridge back to Aztec</div>
        {s3 !== 'completed' ? (
          <div className="swap-step-actions">
            <button
              className="claim-button"
              onClick={onClaim}
              disabled={s3 !== 'active' || isClaimLoading}
            >
              {isClaimLoading ? 'Claiming' : 'Claim'}
            </button>
          </div>
        ) : (
          <a
            className="swap-step-link"
            href={explorer}
            target="_blank"
            rel="noreferrer"
          >
            tx hash
          </a>
        )}
      </Step>
    </div>
  );
};

export default SwapProgress;

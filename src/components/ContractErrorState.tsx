import React from 'react';

interface ContractErrorStateProps {
  className: string;
  icon: string;
  title: string;
  onRetry?: () => void;
}

export const ContractErrorState: React.FC<ContractErrorStateProps> = ({
  className,
  icon,
  title,
  onRetry,
}) => {
  return (
    <div className={className}>
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">{icon}</span>
        </div>
        <div>
          <h3>{title}</h3>
          <p className="contract-error-subtitle">Contract registration issue</p>
        </div>
      </div>
      <div className="contract-error-body">
        <span className="contract-error-icon">⚠️</span>
        <p className="contract-error-text">
          Something went wrong while registering contracts.
          <br />
          Please try again or check the console logs for details.
        </p>
        {onRetry && (
          <button onClick={onRetry} className="contract-error-retry">
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

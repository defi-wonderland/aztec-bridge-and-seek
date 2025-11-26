import React from 'react';

interface ContractLoadingStateProps {
  className: string;
  icon: string;
  title: string;
}

export const ContractLoadingState: React.FC<ContractLoadingStateProps> = ({
  className,
  icon,
  title,
}) => {
  return (
    <div className={className}>
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">{icon}</span>
        </div>
        <div>
          <h3>{title}</h3>
          <p>Loading contracts...</p>
        </div>
      </div>
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Registering contracts with PXE...</p>
      </div>
    </div>
  );
};


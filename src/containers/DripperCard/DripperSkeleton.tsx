import React from 'react';

export const DripperSkeleton: React.FC = () => (
  <div className="dripper-content">
    <div className="skeleton-header">
      <div className="skeleton-icon" />
      <div className="skeleton-text-group">
        <div className="skeleton-title" />
        <div className="skeleton-subtitle" />
      </div>
    </div>
    <div className="mint-form-container">
      <div className="skeleton-form">
        <div className="skeleton-group">
          <div className="skeleton-label" />
          <div className="skeleton-input" />
        </div>
        <div className="skeleton-group">
          <div className="skeleton-label" />
          <div className="skeleton-input" />
        </div>
        <div className="skeleton-group">
          <div className="skeleton-label" />
          <div className="skeleton-select" />
        </div>
        <div className="skeleton-button" />
      </div>
    </div>
  </div>
);


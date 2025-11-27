import React from 'react';

export const BridgeSkeleton: React.FC = () => (
  <div className="bridge-card skeleton-content">
    <div className="skeleton-header">
      <div className="skeleton-icon" />
      <div className="skeleton-text-group">
        <div className="skeleton-title" />
        <div className="skeleton-subtitle" />
      </div>
    </div>
    <div className="bridge-subtabs">
      <div className="bridge-subtabs-list">
        <div className="skeleton-input" style={{ height: '2.5rem', width: '50%' }} />
        <div className="skeleton-input" style={{ height: '2.5rem', width: '50%' }} />
      </div>
    </div>
    <div className="bridge-content">
      <div className="skeleton-form">
        <div className="skeleton-group">
          <div className="skeleton-label" />
          <div className="skeleton-input" />
        </div>
        <div className="skeleton-group">
          <div className="skeleton-label" />
          <div className="skeleton-input" />
        </div>
        <div className="skeleton-button" />
      </div>
    </div>
  </div>
);


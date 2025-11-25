import React from 'react';

export const InfoSkeleton: React.FC = () => (
  <div className="info-content">
    <div className="skeleton-header">
      <div className="skeleton-icon" />
      <div className="skeleton-text-group">
        <div className="skeleton-title" />
        <div className="skeleton-subtitle" />
      </div>
    </div>
    <div className="info-section">
      <div className="skeleton-label" style={{ width: '8rem', marginBottom: '1rem' }} />
      <div className="skeleton-form">
        <div className="skeleton-group">
          <div className="skeleton-label" style={{ width: '5rem' }} />
          <div className="skeleton-input" style={{ height: '1.5rem' }} />
        </div>
        <div className="skeleton-group">
          <div className="skeleton-label" style={{ width: '5rem' }} />
          <div className="skeleton-input" style={{ height: '1.5rem' }} />
        </div>
      </div>
    </div>
    <div className="info-section">
      <div className="skeleton-label" style={{ width: '10rem', marginBottom: '1rem' }} />
      <div className="skeleton-form">
        <div className="skeleton-group">
          <div className="skeleton-label" style={{ width: '7rem' }} />
          <div className="skeleton-input" />
        </div>
        <div className="skeleton-group">
          <div className="skeleton-label" style={{ width: '7rem' }} />
          <div className="skeleton-input" />
        </div>
      </div>
    </div>
  </div>
);


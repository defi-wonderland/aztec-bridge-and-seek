import React from 'react';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <div className="layout-grid">
        <MainContent />
      </div>
    </div>
  );
};

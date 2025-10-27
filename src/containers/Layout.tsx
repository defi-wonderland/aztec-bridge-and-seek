import React from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <div className="layout-grid">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
};

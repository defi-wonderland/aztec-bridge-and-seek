import React, { useEffect, useState } from 'react';
import { TabType, TabConfig } from '../types';

interface TabsProps {
  tabs: TabConfig[];
  defaultTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab = 'mint',
  onTabChange,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const renderTabContent = () => {
    const activeTabConfig = tabs.find((tab) => tab.id === activeTab);
    return activeTabConfig?.component || tabs[0]?.component;
  };

  // Allow external components to switch tabs by dispatching a CustomEvent('open-tab', { detail: { id: TabType } })
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: TabType }>;
      if (ce.detail?.id) {
        handleTabChange(ce.detail.id);
      }
    };
    window.addEventListener('open-tab', handler as EventListener);
    return () =>
      window.removeEventListener('open-tab', handler as EventListener);
  }, []);

  return (
    <div className="tabs-wrapper">
      {/* Tab Navigation */}
      <div className="tabs-container">
        <div className="tabs-list">
          {tabs
            .filter((tab) => !tab.hidden)
            .map((tab) => (
              <button
                key={tab.id}
                className={`tab-trigger ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content-wrapper">
        {children || renderTabContent()}
      </div>
    </div>
  );
};

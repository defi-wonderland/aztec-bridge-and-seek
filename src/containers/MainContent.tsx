import React from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { BridgeCard } from './BridgeCard';
import { SendersCard } from './SendersCard';
import { InfoCard } from './InfoCard';
import { Tabs } from '../components';
import { TabConfig } from '../types';

export const MainContent: React.FC = () => {
  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />
    },
    {
      id: 'bridge',
      label: 'Bridge',
      icon: '🌉',
      component: <BridgeCard />
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      component: <SettingsCard />
    },
    {
      id: 'senders',
      label: 'Senders',
      icon: '👥',
      component: <SendersCard />
    },
    {
      id: 'info',
      label: 'Info',
      icon: 'ℹ️',
      component: <InfoCard />
    }
  ];

  return (
    <main className="main-content">
      <Tabs tabs={tabs} />
    </main>
  );
};

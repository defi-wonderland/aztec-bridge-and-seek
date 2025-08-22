import React from 'react';
import { DripperCard } from './DripperCard';
import { VotingCard } from './VotingCard';
import { SettingsCard } from './SettingsCard';
import { BridgeInCard } from './BridgeInCard';
import { BridgeOutCard } from './BridgeOutCard';
import { Tabs } from '../components';
import { TabConfig } from '../types';

export const MainContent: React.FC = () => {
  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />,
    },
    {
      id: 'vote',
      label: 'Vote',
      icon: '🗳️',
      component: <VotingCard />,
    },
    {
      id: 'bridgeIn',
      label: 'Bridge In',
      icon: '🌉',
      component: <BridgeInCard />,
    },
    {
      id: 'bridgeOut',
      label: 'Bridge Out',
      icon: '🚀',
      component: <BridgeOutCard />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      component: <SettingsCard />,
    },
  ];

  return (
    <main className="main-content">
      <Tabs tabs={tabs} />
    </main>
  );
};

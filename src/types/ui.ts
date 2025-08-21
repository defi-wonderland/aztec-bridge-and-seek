// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = 'mint' | 'vote' | 'bridgeIn' | 'settings';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}

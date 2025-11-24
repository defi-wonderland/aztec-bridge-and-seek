// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = 'mint' | 'settings' | 'bridge' | 'senders' | 'info';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}

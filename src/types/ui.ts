// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType =
  | 'mint'
  | 'settings'
  | 'bridge'
  | 'senders'
  | 'swap'
  | 'info';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}

export type ValidationResult =
  | { success: true; value: string }
  | { success: false; value: string; error: string };

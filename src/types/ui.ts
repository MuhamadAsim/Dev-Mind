// ============================================================
// UI State Types
// ============================================================

export type Theme = 'dark' | 'light' | 'system';
export type PanelSize = 'collapsed' | 'normal' | 'expanded';

export interface UIState {
  theme: Theme;
  isSidebarOpen: boolean;
  isRepoPanelOpen: boolean;
  sidebarWidth: number;
  repoPanelWidth: number;
  commandPaletteOpen: boolean;
}

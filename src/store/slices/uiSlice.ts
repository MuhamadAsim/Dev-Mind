// ============================================================
// UI Slice — sidebar, panel, theme, command palette
// ============================================================
import { StateCreator } from 'zustand';
import { Theme } from '@/types/ui';
import { UI_DEFAULTS } from '@/lib/constants';
import type { RootStore } from '../index';

export interface UISlice {
  // State
  theme: Theme;
  isSidebarOpen: boolean;
  isRepoPanelOpen: boolean;
  sidebarWidth: number;
  repoPanelWidth: number;
  commandPaletteOpen: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleRepoPanel: () => void;
  setRepoPanelOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setRepoPanelWidth: (width: number) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const createUISlice: StateCreator<RootStore, [], [], UISlice> = (set) => ({
  theme: 'dark',
  isSidebarOpen: UI_DEFAULTS.SIDEBAR_OPEN,
  isRepoPanelOpen: UI_DEFAULTS.REPO_PANEL_OPEN,
  sidebarWidth: UI_DEFAULTS.SIDEBAR_WIDTH,
  repoPanelWidth: UI_DEFAULTS.REPO_PANEL_WIDTH,
  commandPaletteOpen: false,

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleRepoPanel: () => set((s) => ({ isRepoPanelOpen: !s.isRepoPanelOpen })),
  setRepoPanelOpen: (open) => set({ isRepoPanelOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setRepoPanelWidth: (width) => set({ repoPanelWidth: width }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
});

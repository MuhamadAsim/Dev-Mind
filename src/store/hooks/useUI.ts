// Components must import from here — not from useStore directly
import { useStore } from '../index';

export const useTheme = () => useStore((s) => s.theme);
export const useSetTheme = () => useStore((s) => s.setTheme);
export const useIsSidebarOpen = () => useStore((s) => s.isSidebarOpen);
export const useToggleSidebar = () => useStore((s) => s.toggleSidebar);
export const useSetSidebarOpen = () => useStore((s) => s.setSidebarOpen);
export const useIsRepoPanelOpen = () => useStore((s) => s.isRepoPanelOpen);
export const useToggleRepoPanel = () => useStore((s) => s.toggleRepoPanel);
export const useSetRepoPanelOpen = () => useStore((s) => s.setRepoPanelOpen);
export const useSidebarWidth = () => useStore((s) => s.sidebarWidth);
export const useRepoPanelWidth = () => useStore((s) => s.repoPanelWidth);
export const useCommandPaletteOpen = () => useStore((s) => s.commandPaletteOpen);
export const useSetCommandPaletteOpen = () => useStore((s) => s.setCommandPaletteOpen);

'use client';

import { useEffect } from 'react';
import { useToggleSidebar, useToggleRepoPanel, useSetCommandPaletteOpen } from '@/store/hooks/useUI';

/**
 * Global keyboard shortcuts for the workspace.
 * Must be mounted once inside the workspace layout.
 */
export function useKeyboardShortcuts() {
  const toggleSidebar = useToggleSidebar();
  const toggleRepoPanel = useToggleRepoPanel();
  const setCommandPaletteOpen = useSetCommandPaletteOpen();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      if (!isModifier) return;

      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          toggleSidebar();
          break;
        case 'r':
          e.preventDefault();
          toggleRepoPanel();
          break;
        case 'k':
          e.preventDefault();
          setCommandPaletteOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleRepoPanel, setCommandPaletteOpen]);
}

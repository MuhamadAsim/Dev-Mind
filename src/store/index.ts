// ============================================================
// Root Zustand Store — composes all slices
// Uses devtools + persist middleware
// ============================================================
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createChatSlice, ChatSlice } from './slices/chatSlice';
import { createRepoSlice, RepoSlice } from './slices/repoSlice';

export type RootStore = AuthSlice & UISlice & ChatSlice & RepoSlice;

export const useStore = create<RootStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createUISlice(...args),
        ...createChatSlice(...args),
        ...createRepoSlice(...args),
      }),
      {
        name: 'devmind-store',
        // Only persist UI preferences — conversations + repos live in MongoDB
        partialize: (s) => ({
          theme: s.theme,
          isSidebarOpen: s.isSidebarOpen,
          isRepoPanelOpen: s.isRepoPanelOpen,
        }),
      }
    ),
    { name: 'DevMind Store' }
  )
);

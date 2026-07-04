// ============================================================
// Root Zustand Store — composes all slices
// Uses devtools + persist middleware
// ============================================================
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createChatSlice, ChatSlice } from './slices/chatSlice';

export type RootStore = AuthSlice & UISlice & ChatSlice;

export const useStore = create<RootStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createUISlice(...args),
        ...createChatSlice(...args),
      }),
      {
        name: 'devmind-store',
        // Only persist UI preferences — conversations now live in MongoDB
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

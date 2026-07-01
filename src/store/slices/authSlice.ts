// ============================================================
// Auth Slice — handles user session state
// ============================================================
import { StateCreator } from 'zustand';
import { MockUser } from '@/types/user';
import { loginMock, logoutMock, getStoredUser } from '@/lib/auth';
import type { RootStore } from '../index';

export interface AuthSlice {
  // State
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: () => MockUser;
  logout: () => void;
  initAuth: () => void;
}

export const createAuthSlice: StateCreator<RootStore, [], [], AuthSlice> = (set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: () => {
    const user = loginMock();
    set({ user, isAuthenticated: true, isLoading: false });
    return user;
  },

  logout: () => {
    logoutMock();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  initAuth: () => {
    const user = getStoredUser();
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  },
});

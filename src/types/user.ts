// ============================================================
// User & Authentication Types
// Replace lib/auth.ts mock helpers with real GitHub OAuth later
// ============================================================

export type UserRole = 'developer' | 'admin';

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  sidebarCollapsed: boolean;
  repoPanelCollapsed: boolean;
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  /** null until real GitHub OAuth is connected */
  githubUsername: string | null;
  createdAt: string; // ISO date string
  preferences: UserPreferences;
}

export interface AuthState {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Storage keys — single source of truth
export const SESSION_STORAGE_KEY = 'devmind_user' as const;
export const SESSION_COOKIE_KEY = 'devmind_session' as const;

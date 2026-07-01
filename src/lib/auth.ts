// ============================================================
// Mock Auth Helpers
// REPLACE THIS FILE with real GitHub OAuth when ready.
// The MockUser shape mirrors what GitHub OAuth returns so
// the swap is a drop-in with minimal refactoring.
// ============================================================
import { MockUser, SESSION_STORAGE_KEY, SESSION_COOKIE_KEY } from '@/types/user';
import { generateId } from './utils';

/** The single mock developer account */
const MOCK_USER: MockUser = {
  id: 'usr_devmind_local_001',
  name: 'Dev User',
  email: 'dev@devmind.ai',
  avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=devmind&backgroundColor=6366f1',
  role: 'developer',
  githubUsername: null, // null until real OAuth
  createdAt: '2025-01-01T00:00:00.000Z',
  preferences: {
    theme: 'dark',
    sidebarCollapsed: false,
    repoPanelCollapsed: true,
  },
};

/**
 * Simulate login — stores mock user in localStorage + sets a session cookie.
 * REPLACE: call your OAuth provider here and store the real user.
 */
export function loginMock(): MockUser {
  if (typeof window === 'undefined') {
    throw new Error('loginMock() must be called client-side');
  }

  const user: MockUser = {
    ...MOCK_USER,
    id: `usr_${generateId()}`,
    createdAt: new Date().toISOString(),
  };

  // Persist full user object to localStorage
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));

  // Set a session cookie so middleware (server-side) can read it
  // In production this would be an httpOnly cookie set by the server
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  document.cookie = `${SESSION_COOKIE_KEY}=1; path=/; expires=${expiryDate.toUTCString()}; SameSite=Lax`;

  return user;
}

/**
 * Simulate logout — clears localStorage and expires the session cookie.
 * REPLACE: call your OAuth provider's logout endpoint here.
 */
export function logoutMock(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(SESSION_STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * Read the stored user from localStorage.
 * Returns null if not logged in or if storage is unavailable.
 */
export function getStoredUser(): MockUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
}

/**
 * Check if a session cookie exists (client-side readable version).
 */
export function hasSessionCookie(): boolean {
  if (typeof window === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${SESSION_COOKIE_KEY}=`));
}

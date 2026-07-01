// ============================================================
// App-wide constants — single source of truth
// ============================================================

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  WORKSPACE: '/workspace',
} as const;

export const STORAGE_KEYS = {
  USER: 'devmind_user',
  THEME: 'devmind_theme',
} as const;

export const COOKIE_KEYS = {
  SESSION: 'devmind_session',
} as const;

export const UI_DEFAULTS = {
  SIDEBAR_WIDTH: 260,
  REPO_PANEL_WIDTH: 280,
  SIDEBAR_OPEN: true,
  REPO_PANEL_OPEN: false,
} as const;

export const APP_META = {
  NAME: 'DevMind AI',
  TAGLINE: 'Your personal AI engineering workspace',
  VERSION: '0.1.0',
} as const;

export const MOCK_SUGGESTIONS = [
  'Explain this codebase to me',
  'Help me debug this TypeScript error',
  'Write a React component for a data table',
  'Review my API design and suggest improvements',
  'Generate unit tests for my utility functions',
  'Help me set up CI/CD with GitHub Actions',
] as const;

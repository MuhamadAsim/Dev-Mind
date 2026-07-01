// Components must import from here — not from useStore directly
import { useStore } from '../index';

export const useCurrentUser = () => useStore((s) => s.user);
export const useIsAuthenticated = () => useStore((s) => s.isAuthenticated);
export const useIsAuthLoading = () => useStore((s) => s.isLoading);
export const useLogin = () => useStore((s) => s.login);
export const useLogout = () => useStore((s) => s.logout);
export const useInitAuth = () => useStore((s) => s.initAuth);

/**
 * Global auth store using Zustand.
 *
 * Hydration is done synchronously at module load so the very first
 * render of route guards (e.g. `ProtectedRoute`) sees the correct
 * auth state. Without this, hard-loading a deep link such as
 * `/tasks/123` would race: the first render believes the user is
 * signed out, redirects to `/login`, and only THEN does the hydrate
 * effect run — at which point the public-route guard kicks the user
 * over to `/` (or `/admin`), losing the original URL.
 */

import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

function readPersistedAuth(): { token: string | null; user: User | null } {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }
  const token = window.localStorage.getItem('vulnseeker_token');
  const userStr = window.localStorage.getItem('vulnseeker_user');
  if (!token || !userStr) {
    return { token: null, user: null };
  }
  try {
    return { token, user: JSON.parse(userStr) as User };
  } catch {
    window.localStorage.removeItem('vulnseeker_token');
    window.localStorage.removeItem('vulnseeker_user');
    return { token: null, user: null };
  }
}

const persisted = readPersistedAuth();

export const useAuthStore = create<AuthStore>((set) => ({
  user: persisted.user,
  token: persisted.token,
  isAuthenticated: Boolean(persisted.token && persisted.user),

  login: (token: string, user: User) => {
    localStorage.setItem('vulnseeker_token', token);
    localStorage.setItem('vulnseeker_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('vulnseeker_token');
    localStorage.removeItem('vulnseeker_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

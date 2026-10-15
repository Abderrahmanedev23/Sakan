'use client';

import type { AuthResponse, UserProfile } from '@sakan/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';

const TOKEN_KEY = 'sakan.token';

interface AuthState {
  /** undefined while the stored token is being checked. */
  user: UserProfile | null | undefined;
  token: string | null;
  signIn: (response: AuthResponse) => void;
  signOut: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null | undefined>(undefined);

  const load = useCallback(async (current: string | null) => {
    if (!current) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.me(current));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    setToken(stored);
    void load(stored);
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      signIn: (response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setUser(response.user);
      },
      signOut: async () => {
        if (token) await api.logout(token).catch(() => undefined);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
      setUser,
      refresh: () => load(token),
    }),
    [user, token, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

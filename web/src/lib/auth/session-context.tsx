'use client';

/**
 * SessionProvider — client-side auth/session/tenant/permission state.
 * - AUTH_MODE='real': logs in via the real backend (AuthService + adapter),
 *   persists the session and the tokens.
 * - AUTH_MODE='mock': P1 demo accounts (controlled development fallback only).
 * On restore, re-hydrates the session and syncs the token store.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthResponse, AuthStatus, LoginInput, Session } from '@/types/auth';
import { AUTH_MODE, realLogin, realLogout } from './auth-service';
import { mockLogin } from './mock-session';
import { hasPermission, PermissionKey } from './permissions';
import { tokenStore } from './token-store';

const SESSION_KEY = 'assetx.session.v1';

interface SessionContextValue {
  status: AuthStatus;
  session: Session | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  /** has permission (wildcard-aware) */
  can: (permission: PermissionKey) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function toSession(auth: AuthResponse): Session {
  return {
    user: auth.user,
    tenant: auth.tenant,
    permissions: auth.permissions,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        setSession(s);
        if (s.accessToken) tokenStore.set(s.accessToken, s.refreshToken ?? null);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    } catch {
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const auth = AUTH_MODE === 'mock' ? mockLogin(input.username, input.password) : await realLogin(input);
    const s = toSession(auth);
    setSession(s);
    setStatus('authenticated');
    if (s.accessToken) tokenStore.set(s.accessToken, s.refreshToken ?? null);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const logout = useCallback(async () => {
    if (AUTH_MODE === 'real') {
      try { await realLogout(); } catch { /* best-effort */ }
    }
    tokenStore.clear();
    setSession(null);
    setStatus('unauthenticated');
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const can = useCallback(
    (permission: PermissionKey) => hasPermission(session?.permissions, permission),
    [session],
  );

  const value = useMemo(
    () => ({ status, session, login, logout, can }),
    [status, session, login, logout, can],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function useCan(): (p: PermissionKey) => boolean {
  return useSession().can;
}

'use client';

/**
 * SessionProvider — client-side auth/session/tenant/permission state.
 * Persists the session to localStorage so the shell restores on refresh.
 * In AUTH_MODE=mock it signs in via the P1 demo accounts; in 'real' mode it
 * calls the AssetX backend AuthService.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthResponse, AuthStatus, LoginInput, Session } from '@/types/auth';
import { AUTH_MODE, login as realLogin } from './auth-service';
import { mockLogin } from './mock-session';
import { hasPermission, PermissionKey } from './permissions';

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
        setSession(JSON.parse(raw) as Session);
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
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const logout = useCallback(() => {
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

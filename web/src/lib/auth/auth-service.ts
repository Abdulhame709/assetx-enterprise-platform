/**
 * AuthService — real authentication against the AssetX backend.
 * AUTH_MODE='real' uses the real backend + adapter mapping.
 * AUTH_MODE='mock' uses the P1 demo accounts (controlled dev fallback only).
 */
import { Session, LoginInput } from '@/types/auth';
import { http } from '@/lib/api/client';
import { BackendLoginResponse, buildSessionFromLogin, buildSessionFromPayload, decodeJwtPayload, isTokenExpired } from './auth-adapter';
import { tokenStore } from './token-store';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'real';

export async function realLogin(input: LoginInput): Promise<Session> {
  const res = await http.post<BackendLoginResponse>('/auth/login', { username: input.username, password: input.password });
  return buildSessionFromLogin(res);
}

/** Refresh the access token using the stored refresh token. Returns new session or null. */
export async function refreshSession(): Promise<Session | null> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await http.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
    const payload = decodeJwtPayload(res.accessToken);
    tokenStore.set(res.accessToken, refreshToken);
    return buildSessionFromPayload(res.accessToken, refreshToken, payload);
  } catch {
    // refresh failed → drop stored tokens so we don't retry with a stale refresh token
    tokenStore.clear();
    return null;
  }
}

/**
 * Restore/refresh a persisted session on page reload.
 * - If the stored access token is still valid, rehydrate from it.
 * - If it is expired (or expiring), attempt a refresh; on failure, return null
 *   so the caller logs the user out (expired session handling).
 */
export async function restoreSessionFromStored(): Promise<Session | null> {
  const accessToken = tokenStore.getAccess();
  const refreshToken = tokenStore.getRefresh();
  if (!accessToken) return null;

  if (!isTokenExpired(accessToken)) {
    return buildSessionFromPayload(accessToken, refreshToken, decodeJwtPayload(accessToken));
  }
  return refreshSession();
}

export async function realLogout(): Promise<void> {
  const token = tokenStore.getAccess();
  try {
    await http.post('/auth/logout', {}, token);
  } catch {
    /* best-effort logout */
  }
  tokenStore.clear();
}

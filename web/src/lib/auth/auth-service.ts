/**
 * AuthService — real authentication against the AssetX backend.
 * AUTH_MODE='real' uses the real backend + adapter mapping.
 * AUTH_MODE='mock' uses the P1 demo accounts (controlled dev fallback only).
 */
import { Session, LoginInput } from '@/types/auth';
import { http } from '@/lib/api/client';
import { buildSessionFromLogin, decodeJwtPayload } from './auth-adapter';
import { tokenStore } from './token-store';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'mock';

interface BackendLoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; username: string; tenant_id: string };
}

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
    return {
      user: {
        id: payload.sub ?? '',
        username: payload.username ?? '',
        displayName: payload.username ?? 'User',
        roles: payload.roles ?? (payload.role ? [payload.role] : []),
      },
      tenant: { id: payload.tenant_id ?? '', name: '', code: '' },
      permissions: payload.permissions ?? [],
      accessToken: res.accessToken,
      refreshToken,
    };
  } catch {
    return null;
  }
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

'use client';

/**
 * Auth Adapter (Phase PRE-P3.1) — maps the real backend auth contract to the
 * frontend Session shape WITHOUT modifying the backend.
 *
 * Backend POST /auth/login returns:
 *   { accessToken, refreshToken, user: { id, username, tenant_id } }
 * and the JWT payload carries roles + permissions + tenant_id.
 *
 * This adapter:
 *   1. reads the returned tokens,
 *   2. decodes the JWT payload (user id, tenant_id, roles, permissions),
 *   3. calls GET /tenant/current for tenant name/code,
 *   4. builds a unified Session compatible with the frontend.
 */
import { Session } from '@/types/auth';
import { tokenStore } from './token-store';
import { API_BASE_URL } from '@/lib/api/client';

/** Raw backend POST /auth/login response (contract — do not widen without backend change). */
export interface BackendLoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; username: string; tenant_id: string };
}

interface JwtPayload {
  sub?: string;
  username?: string;
  tenant_id?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

interface JwtPayloadWithExp extends JwtPayload {
  /** epoch seconds when the token expires */
  exp?: number;
}

/** Decode a JWT payload (base64url, no external dependency). */
export function decodeJwtPayload(token: string): JwtPayload {
  const part = token.split('.')[1];
  if (!part) return {};
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  try {
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  } catch {
    try { return JSON.parse(atob(pad)); } catch { return {}; }
  }
}

/** Whether an access token is expired (or expiring within `skewSeconds`). */
export function isTokenExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token) as JwtPayloadWithExp;
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return false; // no exp => treat as valid
  const expiresAtMs = payload.exp * 1000;
  return expiresAtMs - skewSeconds * 1000 <= Date.now();
}

/** Build a Session from a decoded JWT payload + optional tenant details. */
export function buildSessionFromPayload(
  accessToken: string,
  refreshToken: string | null,
  payload: JwtPayload,
  tenant?: { id: string; name: string; code: string },
): Session {
  const username = payload.username ?? '';
  return {
    user: {
      id: payload.sub ?? '',
      username,
      displayName: username || 'User',
      roles: payload.roles ?? (payload.role ? [payload.role] : []),
    },
    tenant: tenant ?? { id: payload.tenant_id ?? '', name: '', code: '' },
    permissions: payload.permissions ?? [],
    accessToken,
    refreshToken: refreshToken ?? undefined,
  };
}

/** Map the real backend login response into a unified frontend Session. */
export async function buildSessionFromLogin(loginResponse: BackendLoginResponse): Promise<Session> {
  tokenStore.set(loginResponse.accessToken, loginResponse.refreshToken ?? null);
  const payload = decodeJwtPayload(loginResponse.accessToken);

  const tenantId = loginResponse.user.tenant_id ?? payload.tenant_id ?? '';

  // Fetch tenant details (name/code) via the real endpoint.
  let tenant = { id: tenantId, name: '', code: '' };
  try {
    const res = await fetch(`${API_BASE_URL}/tenant/current`, {
      headers: { Authorization: `Bearer ${loginResponse.accessToken}` },
    });
    if (res.ok) {
      const t = (await res.json()) as { id: string; tenant_code: string; name: string };
      tenant = { id: t.id ?? tenantId, name: t.name, code: t.tenant_code };
    }
  } catch {
    /* keep default tenant — session still valid via token */
  }

  return buildSessionFromPayload(
    loginResponse.accessToken,
    loginResponse.refreshToken ?? null,
    payload,
    tenant,
  );
}

/**
 * Typed API client layer for the AssetX frontend (Phase PRE-P3.1).
 * - base URL from NEXT_PUBLIC_API_URL (falls back to /api proxy).
 * - auto-injects the Bearer token from the token store.
 * - on 401 with a refresh token available, attempts a one-time refresh and retries.
 * - throws ApiError with status + message for structured handling.
 */

/**
 * Browser calls stay same-origin by default so that the Next.js proxy can
 * reach the backend from the server. A public localhost value would otherwise
 * point to the end user's own device, which breaks login and session refresh
 * from phones or external previews.
 */
export function resolveApiBaseUrl(configuredUrl = process.env.NEXT_PUBLIC_API_URL): string {
  const value = configuredUrl?.trim();
  if (!value || /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(value)) {
    return '/api';
  }
  return value.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: Record<string, unknown>;
  constructor(status: number, message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** explicit token override; auto-attached from store when omitted */
  token?: string | null;
  headers?: Record<string, string>;
  /** set false to skip the automatic 401-refresh-retry */
  skipAuthRefresh?: boolean;
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, headers, skipAuthRefresh } = options;
  const { tokenStore } = await import('../auth/token-store');
  const authToken = token !== undefined ? token : tokenStore.getAccess();

  const doRequest = async (t: string | null): Promise<Response> =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await doRequest(authToken);

  // One-time refresh on 401 (skip when a refresh is already in flight / explicit token).
  if (res.status === 401 && !skipAuthRefresh && token === undefined) {
    const { refreshSession } = await import('../auth/auth-service');
    const newSession = await refreshSession();
    if (newSession) {
      res = await doRequest(newSession.accessToken);
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    let details: Record<string, unknown> = {};
    try {
      const data = (await res.json()) as {
        message?: string;
        error?: string | { code?: string; message?: string; details?: Record<string, unknown> };
        code?: string;
      };
      // Backend error envelope: { data:null, error:{ code, message } }
      const errPayload = data?.error;
      if (typeof errPayload === 'object' && errPayload !== null) {
        code = errPayload.code;
        message = errPayload.message ?? res.statusText;
        details = errPayload.details ?? {};
      } else {
        message = data.message ?? errPayload ?? res.statusText;
        code = data.code;
      }
    } catch {
      /* non-json error body */
    }
    throw new ApiError(res.status, message, code, details);
  }

  return readBody<T>(res);
}

export const http = {
  get: <T = unknown>(path: string, token?: string | null) => apiFetch<T>(path, { method: 'GET', token }),
  post: <T = unknown>(path: string, body?: unknown, token?: string | null) =>
    apiFetch<T>(path, { method: 'POST', body, token }),
  put: <T = unknown>(path: string, body?: unknown, token?: string | null) =>
    apiFetch<T>(path, { method: 'PUT', body, token }),
  patch: <T = unknown>(path: string, body?: unknown, token?: string | null) =>
    apiFetch<T>(path, { method: 'PATCH', body, token }),
  del: <T = unknown>(path: string, token?: string | null) => apiFetch<T>(path, { method: 'DELETE', token }),
};

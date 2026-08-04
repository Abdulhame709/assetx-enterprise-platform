/**
 * Typed API client layer for the AssetX frontend.
 * Points at the AssetX backend (existing services only — no new backend).
 * - base URL from NEXT_PUBLIC_API_URL (falls back to same-origin /api proxy).
 * - injects Bearer token from the session.
 * - throws ApiError with status + message for structured handling.
 * No business endpoints are hardcoded here beyond auth; module endpoints are
 * added when their screens are built (P2+).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, headers } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const data = (await res.json()) as { message?: string; error?: string; code?: string };
      message = data.message ?? data.error ?? res.statusText;
      code = data.code;
    } catch {
      /* non-json error body */
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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

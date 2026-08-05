/**
 * Token store (Phase PRE-P3.1) — holds the real access/refresh tokens in memory
 * and persists them to localStorage so the API client can attach the Bearer
 * token automatically and refresh on 401. Used in real mode only; mock mode is
 * a controlled development fallback.
 */
const ACCESS_KEY = 'assetx.access.v1';
const REFRESH_KEY = 'assetx.refresh.v1';

let memory: { access: string | null; refresh: string | null } = {
  access: null,
  refresh: null,
};

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

export const tokenStore = {
  set(access: string, refresh?: string | null): void {
    memory.access = access;
    memory.refresh = refresh ?? null;
    try {
      localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      else localStorage.removeItem(REFRESH_KEY);
    } catch { /* storage unavailable */ }
  },
  getAccess(): string | null {
    return memory.access ?? read(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return memory.refresh ?? read(REFRESH_KEY);
  },
  clear(): void {
    memory.access = null;
    memory.refresh = null;
    try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  },
};

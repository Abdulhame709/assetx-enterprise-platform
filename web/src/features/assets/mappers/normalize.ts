/**
 * Response Normalization (PRE-P3.2.2).
 * Single source of truth for normalizing API responses that arrive in any of
 * several shapes:
 *   - a bare array:        [...]
 *   - wrapped:             { items: [...] } | { data: [...] } | { results: [...] }
 *   - an object response:  { ... }
 * This keeps the frontend decoupled from the backend's exact envelope so the
 * UI/pages/hooks never depend on a particular response shape.
 *
 * Design: pure functions, no side effects, tolerant of null/undefined/malformed
 * input. If the shape is unrecognized, we fall back to a safe empty result.
 */

const LIST_WRAPPERS = ['items', 'data', 'results', 'rows'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Extract a list from a response that may be an array or a wrapped object. */
export function normalizeList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    for (const key of LIST_WRAPPERS) {
      const value = response[key];
      if (Array.isArray(value)) return value as T[];
    }
    // single-item object with an `id` (e.g. a detail returned as object)
    if (typeof response.id === 'string' || typeof response.id === 'number') {
      return [response as unknown as T];
    }
  }
  return [];
}

/** Extract a single object, tolerant of direct object or first element of a list. */
export function normalizeObject<T>(response: unknown): T | null {
  if (isRecord(response)) return response as T;
  if (Array.isArray(response)) return (response[0] as T) ?? null;
  return null;
}

/** Coerce a list-envelope to a uniform paged shape { items, total }. */
export function normalizePaged<T>(response: unknown, fallbackTotal?: number): { items: T[]; total: number } {
  const items = normalizeList<T>(response);
  let total = items.length;
  if (isRecord(response) && typeof response.total === 'number') {
    total = response.total;
  } else if (typeof fallbackTotal === 'number') {
    total = fallbackTotal;
  }
  return { items, total };
}

/** Boolean-like coercion for safety. */
export function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false' || v === null || v === undefined) return false;
  return fallback;
}

/** Numeric coercion (price/qty) tolerant of string|number|null. */
export function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

/** Human-readable value: hide raw UUIDs behind a clear placeholder. */
export function humanId(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const s = String(value);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(s)) return fallback;
  return s;
}

/**
 * Presentation-layer formatting helpers (Phase UX-1).
 * These are pure display helpers — no business logic / backend changes.
 */

/** True UUID-ish string (used to decide whether to hide an internal id). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): boolean {
  return !!value && UUID_RE.test(value);
}

/** Human-friendly value: hide raw UUIDs behind a placeholder. */
export function humanId(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  if (isUuid(value)) return fallback;
  return value;
}

/**
 * Short, honest reference for an opaque entity id — e.g. "User e3ef402b…" or
 * "Asset 7f056d63…". Unlike humanId (which hides ids entirely), this keeps
 * the reference visible when the human-readable name is unavailable (P1 fix:
 * UX-02 "Unknown asset" / UX-04 "by —"). It never invents a label; the id
 * prefix is the truth until a directory endpoint can resolve names.
 */
export function shortRef(kind: string, value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  if (isUuid(value)) return `${kind} ${value.slice(0, 8)}…`;
  return value;
}

export function formatCurrency(value?: string | number | null, locale = 'en'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

export function formatNumber(value?: number | null, locale = 'en'): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(locale).format(value);
}

/** Locale-aware date-only rendering (e.g. "Mar 1, 2025") — for pure date
 *  fields like purchase_date (P2 fix UX-06: no raw ISO strings in the UI). */
export function formatDate(iso?: string | null, locale = 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' });
  } catch { return iso; }
}

export function toTitle(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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

export function toTitle(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

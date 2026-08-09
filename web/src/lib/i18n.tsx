'use client';

/**
 * AssetX i18n + RTL support (Phase UX-1).
 * Provides:
 *  - a DirectionProvider that toggles html[dir] and persists the preference,
 *  - a lightweight dictionary + t() for translatable labels,
 *  - label maps for internal codes (asset states, movement types, audit actions).
 * No backend changes; presentation-layer mapping only.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

const LANG_KEY = 'assetx.lang.v1';

/** Human labels for internal codes (presentation-only; backend untouched). */
const LABELS: Record<string, string> = {
  // lifecycle states
  draft: 'Draft',
  registered: 'Registered',
  active: 'Active',
  assigned: 'Assigned',
  in_maintenance: 'In Maintenance',
  transferred: 'Transferred',
  disposed: 'Disposed',
  archived: 'Archived',
  // movement types
  transfer: 'Transfer',
  assignment: 'Assignment',
  return: 'Return',
  maintenance_return: 'Maintenance Return',
  disposal: 'Disposal',
  retirement: 'Retirement',
  // movement status
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  // inventory cycle status
  new: 'New',
  in_progress: 'In Progress',
  closed: 'Closed',
  // inventory record result (computed, ADL-006) — `transferred` shared with lifecycle states above
  matched: 'Matched',
  deficit: 'Deficit',
  surplus: 'Surplus',
  missing: 'Missing',
  not_inventoried: 'Not Counted',
  // audit actions (full backend catalog — audit-events.ts)
  AUTH_LOGIN_SUCCESS: 'Sign-in succeeded',
  AUTH_LOGIN_FAILED: 'Sign-in failed',
  AUTH_LOGOUT: 'Signed out',
  AUTH_TOKEN_REFRESH: 'Token refreshed',
  AUTH_REGISTER: 'Account registered',
  AUTH_PASSWORD_RESET: 'Password reset',
  PERMISSION_GRANTED: 'Permission granted',
  PERMISSION_DENIED: 'Permission denied',
  PERMISSION_CHANGED: 'Permission changed',
  ASSET_CREATED: 'Asset created',
  ASSET_UPDATED: 'Asset updated',
  ASSET_STATUS_CHANGED: 'Asset status changed',
  ASSET_DELETED: 'Asset deleted',
  MOVEMENT_CREATED: 'Movement created',
  MOVEMENT_APPROVED: 'Movement approved',
  MOVEMENT_REJECTED: 'Movement rejected',
  INVENTORY_CREATED: 'Inventory cycle created',
  INVENTORY_STARTED: 'Inventory cycle started',
  INVENTORY_CLOSED: 'Inventory cycle closed',
  INVENTORY_RECORD_VERIFIED: 'Inventory record verified',
  COMPLIANCE_WARNING: 'Compliance warning',
  EXPORT_STARTED: 'Export started',
  EXPORT_COMPLETED: 'Export completed',
  EXPORT_FAILED: 'Export failed',
  SAVED_SEARCH_CREATED: 'Saved search created',
  SAVED_SEARCH_UPDATED: 'Saved search updated',
  SAVED_SEARCH_DELETED: 'Saved search deleted',
  SAVED_SEARCH_EXECUTED: 'Saved search executed',
  API_REQUEST: 'API request',
  // misc
  Uncategorized: 'Uncategorized',
  Unassigned: 'Unassigned',
};

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (l: Locale) => void;
  /** human label for an internal code, falling back to the raw value */
  label: (code?: string | null) => string;
  /** whether a code is known/humanized (vs raw internal) */
  isKnownLabel: (code?: string | null) => boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Restore the saved preference once on mount. NOTE (P1 fix UX-03): this
  // effect must be the ONLY storage reader-at-boot and nothing may write
  // LANG_KEY during mount — otherwise the mount-effect ordering race
  // (write of the default 'en' before the restore re-reads) destroys the
  // saved preference. Persistence therefore happens only in setLocale
  // (an explicit user gesture), never in the dir-sync effect.
  useEffect(() => {
    const saved = (localStorage.getItem(LANG_KEY) as Locale) || 'en';
    setLocaleState(saved === 'ar' ? 'ar' : 'en');
  }, []);

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    setLocaleState(l);
  }, []);
  const dir: Direction = locale === 'ar' ? 'rtl' : 'ltr';

  const label = useCallback((code?: string | null): string => {
    if (!code) return '—';
    return LABELS[code] ?? code;
  }, []);

  const isKnownLabel = useCallback((code?: string | null): boolean => !!code && code in LABELS, []);

  const value = useMemo(
    () => ({ locale, dir, setLocale, label, isKnownLabel }),
    [locale, dir, setLocale, label, isKnownLabel],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Locale-aware date/time formatting (respects the current dir). */
export function formatDateTime(iso?: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch { return iso; }
}

/** Relative time ("3 days ago") — readable timestamps without backend changes. */
export function relativeTime(iso?: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  const suffix = diffMs >= 0 ? 'ago' : 'from now';
  const unit = locale === 'ar' ? 'منذ' : '';
  if (min < 1) return locale === 'ar' ? 'الآن' : 'just now';
  if (min < 60) return locale === 'ar' ? `${unit} ${min} دقيقة` : `${min}m ${suffix}`;
  if (hr < 24) return locale === 'ar' ? `${unit} ${hr} ساعة` : `${hr}h ${suffix}`;
  if (day < 30) return locale === 'ar' ? `${unit} ${day} يوم` : `${day}d ${suffix}`;
  return formatDateTime(iso, locale);
}

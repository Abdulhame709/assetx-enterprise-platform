'use client';

/**
 * Branding (organization name + logo) shown in the app shell. A tiny shared store so the
 * sidebar updates immediately after the Settings page saves a new name or logo.
 */
import { useEffect, useState } from 'react';
import { Branding, getBranding } from './api';

let current: Branding | null = null;
const listeners = new Set<(b: Branding | null) => void>();

function publish(next: Branding | null) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

/** Call after saving settings so every open view shows the new name/logo. */
export function setBranding(next: Branding) {
  publish(next);
}

export function refreshBranding(): Promise<void> {
  return getBranding().then(publish).catch(() => undefined);
}

export function useBranding(): Branding | null {
  const [value, setValue] = useState<Branding | null>(current);
  useEffect(() => {
    listeners.add(setValue);
    void refreshBranding();
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

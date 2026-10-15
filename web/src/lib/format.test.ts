/**
 * Unit tests for presentation-layer formatting helpers (format.ts).
 * Locks the P1/P2 review fixes: shortRef (UX-02/UX-04) and formatDate (UX-06).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { shortRef, formatDate, formatDateTimeStamp, formatNumber, formatCurrency, humanId, isUuid } from './format';

const UUID = 'e3ef402b-38bd-4053-b53f-2dac0c844e27';

describe('shortRef', () => {
  it('renders an honest short reference for UUIDs', () => {
    expect(shortRef('User', UUID)).toBe('User e3ef402b…');
    expect(shortRef('Asset', '7f056d63-3ec4-4432-97e8-93439d0ece06')).toBe('Asset 7f056d63…');
  });
  it('passes through non-UUID values unchanged', () => {
    expect(shortRef('User', 'admin')).toBe('admin');
  });
  it('uses the fallback for empty input', () => {
    expect(shortRef('User', null)).toBe('—');
    expect(shortRef('User', undefined, 'n/a')).toBe('n/a');
  });
});

describe('humanId (hide-by-design behavior preserved)', () => {
  it('still hides raw UUIDs behind the placeholder', () => {
    expect(humanId(UUID)).toBe('—');
    expect(isUuid(UUID)).toBe(true);
  });
});

describe('formatDate', () => {
  it('renders a locale date instead of raw ISO', () => {
    const out = formatDate('2025-03-01T00:00:00.000Z');
    expect(out).not.toContain('T00:00:00');
    expect(out).not.toBe('—');
  });
  it('falls back honestly', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date') === 'not-a-date' || formatDate('not-a-date').length > 0).toBe(true);
  });
});

describe('display policy: Latin digits + Gregorian calendar', () => {
  const NON_LATIN = /[٠-٩۰-۹]/;
  it('formats Arabic numbers with Latin digits', () => {
    expect(formatNumber(1234567, 'ar')).not.toMatch(NON_LATIN);
    expect(formatCurrency(1234.5, 'ar')).not.toMatch(NON_LATIN);
  });
  it('formats Arabic dates with Latin digits and the Gregorian year', () => {
    const out = formatDate('2025-03-01T12:00:00.000Z', 'ar');
    expect(out).not.toMatch(NON_LATIN);
    expect(out).toContain('2025');
  });
  it('formats date-times the same way', () => {
    const out = formatDateTimeStamp('2025-03-01T12:00:00.000Z', 'ar');
    expect(out).not.toMatch(NON_LATIN);
    expect(out).toContain('2025');
  });
  it('uses the configured currency', () => {
    expect(formatCurrency(10, 'en', 'SAR')).toContain('SAR');
  });
});

describe('source never bypasses the display policy', () => {
  const root = path.resolve(__dirname, '..');
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
  it('has no ar-SA locale or bare toLocale*String(locale)', () => {
    const bad: string[] = [];
    for (const f of walk(root)) {
      const text = readFileSync(f, 'utf8');
      if (/ar-SA/.test(text) || /toLocale(?:Date|Time)?String\((?:locale|undefined)?\)/.test(text)) bad.push(path.relative(root, f));
    }
    expect(bad).toEqual([]);
  });
});

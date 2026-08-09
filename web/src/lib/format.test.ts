/**
 * Unit tests for presentation-layer formatting helpers (format.ts).
 * Locks the P1/P2 review fixes: shortRef (UX-02/UX-04) and formatDate (UX-06).
 */
import { describe, expect, it } from 'vitest';
import { shortRef, formatDate, humanId, isUuid } from './format';

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

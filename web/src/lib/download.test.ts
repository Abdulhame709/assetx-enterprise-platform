import { describe, expect, it } from 'vitest';
import { filenameFromDisposition } from './download';

describe('filenameFromDisposition', () => {
  it('prefers the UTF-8 name', () => {
    const name = 'تقرير الأصول 2026-10-15.pdf';
    const header = `attachment; filename="assets_1.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`;
    expect(filenameFromDisposition(header, 'x.pdf')).toBe(name);
  });

  it('falls back to the plain name, then to the default', () => {
    expect(filenameFromDisposition('attachment; filename="assets_1.pdf"', 'x.pdf')).toBe('assets_1.pdf');
    expect(filenameFromDisposition('', 'x.pdf')).toBe('x.pdf');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", 'x.pdf')).toBe('x.pdf');
  });
});

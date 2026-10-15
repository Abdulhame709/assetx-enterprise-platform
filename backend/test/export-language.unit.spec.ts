import { contentDisposition, displayFileName } from '../src/api/export/content-disposition';
import { statusName } from '../src/application/export/export-lookups';

describe('export language', () => {
  const map = new Map([['s1', 'Under Maintenance'], ['s2', 'Custom Status']]);

  it('translates built-in statuses only for Arabic', () => {
    expect(statusName(map, 's1')).toBe('تحت الصيانة');
    expect(statusName(map, 's1', 'ar')).toBe('تحت الصيانة');
    expect(statusName(map, 's1', 'en')).toBe('Under Maintenance');
  });

  it('leaves custom status names as typed', () => {
    expect(statusName(map, 's2', 'ar')).toBe('Custom Status');
    expect(statusName(map, 'unknown', 'ar')).toBe('');
  });

  it('names the file after the report title and date', () => {
    const day = new Date('2026-10-15T08:00:00Z');
    expect(displayFileName('تقرير الأصول', day)).toBe('تقرير الأصول 2026-10-15');
    expect(displayFileName('a/b:c*?"<>|d', day)).toBe('a b c d 2026-10-15');
    expect(displayFileName('  ', day)).toBe('');
  });

  it('builds a header with an ASCII fallback and an encoded UTF-8 name', () => {
    const day = new Date('2026-10-15T08:00:00Z');
    const header = contentDisposition('assets_1.pdf', 'تقرير الأصول', day);
    expect(header).toContain('filename="assets_1.pdf"');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('تقرير الأصول 2026-10-15.pdf')}`);
    expect(contentDisposition('assets_1.pdf')).toBe('attachment; filename="assets_1.pdf"');
  });
});

import { describe, expect, it } from 'vitest';
import { mapReportDesigner, mapSettings } from './api';

describe('mapSettings', () => {
  it('maps a full settings payload', () => {
    expect(mapSettings({
      organization_name: 'شركة المثال', logo: 'data:image/png;base64,AAAA', report_signatures: true, report_orientation: 'landscape',
    })).toEqual({
      organization_name: 'شركة المثال', logo: 'data:image/png;base64,AAAA', report_signatures: true, report_orientation: 'landscape',
    });
  });

  it('falls back to safe defaults for missing or unknown values', () => {
    expect(mapSettings(null)).toEqual({ organization_name: '', logo: null, report_signatures: false, report_orientation: 'auto' });
    expect(mapSettings({ logo: '', report_orientation: 'sideways' })).toMatchObject({ logo: null, report_orientation: 'auto' });
  });
});

describe('mapReportDesigner', () => {
  it('maps the catalog, labels and saved columns', () => {
    const designer = mapReportDesigner({
      rows_per_page: 25, show_totals: false, row_numbers: true,
      columns: { assets: ['name', 'status_name'], audit: [] },
      widths: { assets: { name: 30, status_name: 'x' }, audit: {} },
      catalog: { assets: { columns: ['name', 'status_name', 'notes'], defaults: ['name'] } },
      labels: { name: { ar: 'اسم الأصل', en: 'Asset' } },
      titles: { assets: { ar: 'تقرير الأصول', en: 'Assets Report' } },
    });
    expect(designer.rows_per_page).toBe(25);
    expect(designer.show_totals).toBe(false);
    expect(designer.row_numbers).toBe(true);
    expect(designer.columns).toEqual({ assets: ['name', 'status_name'] });
    expect(designer.widths).toEqual({ assets: { name: 30 } });
    expect(designer.catalog.assets.columns).toHaveLength(3);
    expect(designer.labels.name.ar).toBe('اسم الأصل');
  });

  it('uses safe defaults for missing values', () => {
    expect(mapReportDesigner(null)).toEqual({
      rows_per_page: 0, show_totals: true, row_numbers: false, columns: {}, widths: {}, catalog: {}, labels: {}, titles: {},
    });
  });
});

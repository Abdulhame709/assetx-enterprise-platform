import { describe, expect, it } from 'vitest';
import { mapSettings } from './api';

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

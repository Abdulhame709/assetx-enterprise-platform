/**
 * Integration tests — organization settings (name, logo, report defaults) and their
 * effect on the report header. Real PostgreSQL (PGlite).
 */
import { createHarness, Harness } from './support/db.harness';
import { SettingsService, MAX_LOGO_BYTES, decodeLogo } from '../src/application/settings.service';
import { ReportMetaService } from '../src/application/export/report-meta.service';

// 1x1 transparent PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_URI = `data:image/png;base64,${PNG_B64}`;

describe('Settings — integration', () => {
  let h: Harness;
  let settings: SettingsService;
  let meta: ReportMetaService;

  beforeAll(async () => {
    h = await createHarness();
    settings = new SettingsService(h.db);
    meta = new ReportMetaService(settings);
  });

  it('falls back to the tenant name, no logo, signatures off, auto orientation', async () => {
    const s = await settings.get(h.tenantA);
    expect(s.organization_name.length).toBeGreaterThan(0);
    expect(s.logo).toBeNull();
    expect(s.report_signatures).toBe(false);
    expect(s.report_orientation).toBe('auto');
  });

  it('updates the official name and report options', async () => {
    const s = await settings.update(h.tenantA, {
      organization_name: '  شركة المثال القابضة ', report_signatures: true, report_orientation: 'landscape',
    });
    expect(s.organization_name).toBe('شركة المثال القابضة');
    expect(s.report_signatures).toBe(true);
    expect(s.report_orientation).toBe('landscape');
  });

  it('rejects invalid names and option values', async () => {
    await expect(settings.update(h.tenantA, { organization_name: ' ' })).rejects.toThrow('ORGANIZATION_NAME_INVALID');
    await expect(settings.update(h.tenantA, { organization_name: 'x'.repeat(121) })).rejects.toThrow('ORGANIZATION_NAME_INVALID');
    await expect(settings.update(h.tenantA, { report_orientation: 'sideways' })).rejects.toThrow('SETTING_VALUE_INVALID');
    await expect(settings.update(h.tenantA, { report_signatures: 'yes' as never })).rejects.toThrow('SETTING_VALUE_INVALID');
  });

  it('stores a PNG logo, feeds it to the report header, and clears it', async () => {
    const saved = await settings.setLogo(h.tenantA, PNG_URI);
    expect(saved.logo).toBe(PNG_URI);

    const built = await meta.build({
      tenantId: h.tenantA, userName: 'مدير', resource: 'assets', lang: 'ar',
    } as never);
    expect(built.organizationName).toBe('شركة المثال القابضة');
    expect(Buffer.isBuffer(built.logo)).toBe(true);
    expect(built.orientation).toBe('landscape');
    expect(built.signatures).toBe(true);

    const cleared = await settings.clearLogo(h.tenantA);
    expect(cleared.logo).toBeNull();
    const again = await meta.build({ tenantId: h.tenantA, userName: 'x', resource: 'assets', lang: 'en' } as never);
    expect(again.logo).toBeUndefined();
  });

  it('rejects logos that are not PNG/JPEG or are too large', async () => {
    await expect(settings.setLogo(h.tenantA, 'data:image/png;base64,bm90IGFuIGltYWdl')).rejects.toThrow('LOGO_INVALID');
    await expect(settings.setLogo(h.tenantA, 42)).rejects.toThrow('LOGO_INVALID');
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(MAX_LOGO_BYTES)]).toString('base64');
    await expect(settings.setLogo(h.tenantA, `data:image/png;base64,${big}`)).rejects.toThrow('LOGO_INVALID');
    expect(decodeLogo(PNG_URI)?.mime).toBe('image/png');
  });

  it('keeps settings separate per tenant', async () => {
    const b = await settings.get(h.tenantB);
    expect(b.organization_name).not.toBe('شركة المثال القابضة');
    expect(b.report_signatures).toBe(false);
  });
});

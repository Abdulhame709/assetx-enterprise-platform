/**
 * Integration tests — Export Engine (Phase 11.3).
 * CSV/Excel/PDF generation, audit events, tenant isolation. Real PostgreSQL.
 * Reference: Phase 11.3
 */
import { createHarness, Harness } from './support/db.harness';
import { AUDIT_EVENTS } from '../src/core/constants/audit-events';

describe('Export Engine — integration (Phase 11.3)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'exp_user', password: 'Pass123456' });
    userA = u.user.id;
    // seed a couple of assets for export
    await h.assets.create({ tenant_id: h.tenantA, name: 'ExportAsset1', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    await h.assets.create({ tenant_id: h.tenantA, name: 'ExportAsset2', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
  });

  function collect(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      stream.on('data', (c) => (data += c.toString()));
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });
  }

  it('CSV — exports assets as a stream with header + rows', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'csv',
    });
    expect(result.format).toBe('csv');
    expect(result.stream).toBeDefined();
    const csv = await collect(result.stream);
    expect(csv).toContain('name');      // header
    expect(csv).toContain('ExportAsset1'); // row
    expect(csv).toContain('ExportAsset2');
  });

  it('Excel — generates an xlsx stream', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'xlsx',
    });
    expect(result.mimeType).toContain('spreadsheetml');
    expect(result.filename.endsWith('.xlsx')).toBe(true);
    const data = await collect(result.stream);
    // xlsx is binary; just ensure bytes were produced
    expect(data.length).toBeGreaterThan(0);
  });

  it('PDF — generates a pdf stream', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'dashboard', format: 'pdf',
    });
    expect(result.mimeType).toBe('application/pdf');
    const data = await collect(result.stream);
    expect(data.length).toBeGreaterThan(0);
  });

  it('Audit — logs EXPORT_STARTED and EXPORT_COMPLETED', async () => {
    await h.exportService.generate({ tenant_id: h.tenantA, userId: userA, resource: 'movements', format: 'csv' });
    const events = await h.audit.query({ tenant_id: h.tenantA, entity: 'export' });
    const actions = events.items.map((e) => e.action_type);
    expect(actions).toContain(AUDIT_EVENTS.EXPORT_STARTED);
    expect(actions).toContain(AUDIT_EVENTS.EXPORT_COMPLETED);
  });

  it('Tenant isolation — export for tenant A does not leak tenant B data', async () => {
    // add an asset directly in tenant B with a unique global code
    await h.db.setTenant(h.tenantB);
    await h.db.query(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, category_id, status_id, location_id, is_active)
       VALUES ($1,'TenantBSecret','2099-0001','2099-0001@b-secret',1,$2,$3,$4,true)`,
      [h.tenantB, h.refB.category, h.refB.status, h.refB.location],
    );
    const result = await h.exportService.generate({ tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'csv' });
    const csv = await collect(result.stream);
    expect(csv).not.toContain('TenantBSecret'); // no cross-tenant leak
  });

  it('unexpected resource → error', async () => {
    await expect(
      h.exportService.generate({ tenant_id: h.tenantA, userId: userA, resource: 'unknown' as never, format: 'csv' }),
    ).rejects.toThrow('UNSUPPORTED_EXPORT_RESOURCE');
  });
});

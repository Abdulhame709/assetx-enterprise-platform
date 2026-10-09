/**
 * Integration tests — Export Engine (Phase 11.3).
 * CSV/Excel/PDF generation, audit events, tenant isolation. Real PostgreSQL.
 * Reference: Phase 11.3
 */
import { createHarness, Harness } from './support/db.harness';
import { StatusService } from '../src/application/status.service';
import { StatusRepository } from '../src/infrastructure/repositories/status.repository';
import { AUDIT_EVENTS } from '../src/core/constants/audit-events';
import { PdfGenerator } from '../src/infrastructure/export/pdf.generator';

function collect(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (c) => (data += c.toString()));
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

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

  it('Inventory — default export streams latest-cycle records with status names', async () => {
    // use a unique year so the snippet does not collide with the inventory suite
    const statuses = new StatusService(new StatusRepository(h.db), h.db, h.audit);
    const status = await statuses.create({ tenant_id: h.tenantA, name: 'Export Count Status', color: '#111111' });
    const { cycle } = await h.cycles.create(h.tenantA, 2097, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    const assets = await h.records.listByCycle(cycle.id, h.tenantA);
    const target = assets[0];
    await h.records.record(cycle.id, h.tenantA, target.asset_id, {
      actual_quantity: 1,
      actual_location_id: target.expected_location_id ?? undefined,
      actual_status_id: status.id,
    }, userA);
    // no cycle_id filter → provider must pick the latest cycle records
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'inventory', format: 'csv',
    });
    const csv = await collect(result.stream);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain('actual_status_name');
    expect(csv).toContain('Export Count Status');
    // Inventory report must expose real names (asset/location/employee), not IDs.
    expect(csv).toContain('asset_name');
    expect(csv).toContain('asset_code');
    expect(csv).toContain('expected_location_path');
    expect(csv).toContain('actual_location_path');
    expect(csv).toContain('expected_employee_name');
    expect(csv).toContain('actual_employee_name');
    expect(csv).toMatch(/ExportAsset\d/);
  });

  it('Inventory — condition detail line in notes is translated to Arabic on export only', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2098, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    const assets = await h.records.listByCycle(cycle.id, h.tenantA);
    const target = assets[0];
    const notes = 'تفصيل الحالة: New:2 | Needs Maintenance:1';
    await h.records.record(cycle.id, h.tenantA, target.asset_id, {
      actual_quantity: 3,
      actual_location_id: target.expected_location_id ?? undefined,
      notes,
    }, userA);
    // DB keeps the raw English names (they are internal lookup keys)
    const stored = await h.records.listByCycle(cycle.id, h.tenantA);
    expect(stored.find((r) => r.asset_id === target.asset_id)?.notes).toBe(notes);
    // Export-only presentation translates the known names inside the line
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'inventory', format: 'csv',
    });
    const csv = await collect(result.stream);
    expect(csv).toContain('تفصيل الحالة: جديد:2 | يحتاج صيانة:1');
    expect(csv).not.toContain('New:2');
    expect(csv).not.toContain('Needs Maintenance:1');
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

describe('PDF advanced formatting — integration', () => {
  it('produces a valid multi-page PDF with many rows (exercises pagination + footer)', async () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({
      name: `Asset-${i}`, code: `A-${i}`, status: 'Good', location: `Loc-${i % 5}`,
    }));
    const gen = new PdfGenerator();
    const stream = gen.generate(rows, { includeHeaders: true });
    expect(gen.getMimeType()).toBe('application/pdf');
    expect(gen.getFileExtension()).toBe('pdf');
    const data = await collect(stream);
    const buf = Buffer.from(data, 'binary');
    // PDF magic header
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // Many rows => > 1 page => contains multiple page objects
    const pages = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });

  it('PDF — embeds the Arabic font so Arabic text renders (not Helvetica)', async () => {
    const gen = new PdfGenerator();
    const rows = [
      { 'النتيجة': 'مطابق', 'الحالة الفعلية': 'جديد', 'ملاحظات': 'تفصيل الحالة: جديد:2 | يحتاج صيانة:1' },
    ];
    const stream = gen.generate(rows, { includeHeaders: true });
    const data = await collect(stream);
    const buf = Buffer.from(data, 'binary');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // Amiri TTF is embedded as a TrueType font program.
    expect(buf.toString('latin1')).toContain('FontFile2');
  });
});

describe('Web inventory export (exact browser request)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'web_exp', password: 'Pass123456' });
    userA = u.user.id;
    const { cycle } = await h.cycles.create(h.tenantA, 2098, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
  });

  it('PDF + inventory profile + full column catalog streams without error', async () => {
    // Exact payload the reports page sends after the fix.
    const columns = [
      { key: 'record_id', label: 'Record ID', order: 1 },
      { key: 'cycle_id', label: 'Cycle ID', order: 2 },
      { key: 'asset_name', label: 'Asset name', order: 3 },
      { key: 'asset_code', label: 'Asset code', order: 4 },
      { key: 'expected_quantity', label: 'Expected quantity', order: 5 },
      { key: 'actual_quantity', label: 'Actual quantity', order: 6 },
      { key: 'expected_location_path', label: 'Expected location', order: 7 },
      { key: 'actual_location_path', label: 'Actual location', order: 8 },
      { key: 'expected_employee_name', label: 'Expected custodian', order: 9 },
      { key: 'actual_employee_name', label: 'Actual custodian', order: 10 },
      { key: 'expected_status_name', label: 'Expected status', order: 11 },
      { key: 'actual_status_name', label: 'Actual status', order: 12 },
      { key: 'result', label: 'Result', order: 13 },
      { key: 'inventory_date', label: 'Inventory date', order: 14 },
      { key: 'notes', label: 'Notes', order: 15 },
    ];
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'inventory', format: 'pdf',
      options: { profile: 'inventory', columns },
    });
    expect(result.stream).toBeDefined();
    const data = await collect(result.stream);
    expect(data.length).toBeGreaterThan(0);
  });

  it('CSV + new columns contains asset/employee headers', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'inventory', format: 'csv',
      options: {
        profile: 'inventory',
        columns: [
          { key: 'asset_code', label: 'Asset Code', order: 1 },
          { key: 'asset_name', label: 'Asset', order: 2 },
          { key: 'expected_location_path', label: 'Expected Location', order: 3 },
          { key: 'expected_employee_name', label: 'Custodian', order: 4 },
        ],
      },
    });
    const csv = await collect(result.stream);
    // Caller-specified columns win: same-key labels/order come from the
    // web report designer (translated to the UI language), never the profile.
    expect(csv).toContain('Asset Code');
    expect(csv).toContain('Asset');
    expect(csv).toContain('Expected Location');
    expect(csv).toContain('Custodian');
    expect(csv).not.toContain('Expected Custodian');
  });
});

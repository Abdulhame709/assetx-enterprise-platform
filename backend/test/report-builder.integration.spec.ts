/**
 * Integration tests — Report Builder (Task T5).
 * Validation (columns/filters), sorting, grouping, aggregation, export compatibility.
 * Reference: Task T5 approved scope
 */
import { createHarness, Harness } from './support/db.harness';
import { ReportDefinition } from '../src/core/entities/report.entity';

describe('Report Builder — integration (Task T5)', () => {
  let h: Harness;
  let userA: string;

  const baseReport: ReportDefinition = {
    id: 'r1',
    name: 'Assets by status',
    resource: 'assets',
    format: 'csv',
    columns: [{ field: 'name' }, { field: 'status_id' }],
  };

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'rb_user', password: 'Pass123456' });
    userA = u.user.id;
    // seed assets with varying purchase_price for aggregation tests
    await h.assets.create({ tenant_id: h.tenantA, name: 'Asset A', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status, purchase_price: 1000 });
    await h.assets.create({ tenant_id: h.tenantA, name: 'Asset B', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status, purchase_price: 3000 });
    await h.assets.create({ tenant_id: h.tenantA, name: 'Asset C', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status, purchase_price: 5000 });
  });

  it('valid report → builds an ExportRequest', () => {
    const req = h.reportBuilder.buildExportRequest(baseReport, h.tenantA, userA);
    expect(req.resource).toBe('assets');
    expect(req.format).toBe('csv');
    expect(req.tenant_id).toBe(h.tenantA);
    expect(req.options!.filters!.__report).toBeDefined();
  });

  it('invalid columns → throws', () => {
    const bad = { ...baseReport, columns: [{ field: '' }] };
    expect(() => h.reportBuilder.buildExportRequest(bad, h.tenantA, userA)).toThrow('INVALID_REPORT_COLUMN');
  });

  it('invalid filters → throws', () => {
    // operator 'eq' but no value → invalid; cast to bypass compile-time type for the negative case
    const bad = { ...baseReport, filters: [{ field: 'status_id', operator: 'eq' }] } as unknown as ReportDefinition;
    expect(() => h.reportBuilder.validate(bad)).toThrow('INVALID_REPORT_FILTER');
  });

  it('sorting is applied in transformRows', () => {
    const report: ReportDefinition = {
      ...baseReport,
      sorting: [{ field: 'purchase_price', dir: 'desc' }],
      columns: [{ field: 'name' }, { field: 'purchase_price' }],
    };
    const rows = [
      { name: 'A', purchase_price: 1000 },
      { name: 'B', purchase_price: 3000 },
      { name: 'C', purchase_price: 5000 },
    ];
    const out = h.reportBuilder.transformRows(rows, report) as Record<string, unknown>[];
    expect(out[0].purchase_price).toBe(5000);
    expect(out[2].purchase_price).toBe(1000);
  });

  it('grouping with count aggregation', () => {
    const report: ReportDefinition = {
      ...baseReport,
      grouping: [{ field: 'status_id', aggregate: 'count' }],
      columns: [{ field: 'status_id' }],
    };
    const rows = [
      { status_id: 's1', purchase_price: 1000 },
      { status_id: 's1', purchase_price: 3000 },
      { status_id: 's2', purchase_price: 5000 },
    ];
    const out = h.reportBuilder.transformRows(rows, report) as Record<string, unknown>[];
    const s1 = out.find((r) => r.status_id === 's1');
    const s2 = out.find((r) => r.status_id === 's2');
    expect(s1!.count).toBe(2);
    expect(s2!.count).toBe(1);
  });

  it('sum aggregation', () => {
    const report: ReportDefinition = {
      ...baseReport,
      grouping: [{ field: 'status_id', aggregate: 'sum', valueField: 'purchase_price' }],
      columns: [{ field: 'status_id' }],
    };
    const rows = [
      { status_id: 's1', purchase_price: 1000 },
      { status_id: 's1', purchase_price: 2000 },
    ];
    const out = h.reportBuilder.transformRows(rows, report) as Record<string, unknown>[];
    const s1 = out.find((r) => r.status_id === 's1');
    expect(s1!.sum).toBe(3000);
  });

  it('built ExportRequest is compatible with ExportService', async () => {
    const req = h.reportBuilder.buildExportRequest(baseReport, h.tenantA, userA);
    const result = await h.exportService.generate(req);
    expect(result.format).toBe('csv');
    expect(result.filename.endsWith('.csv')).toBe(true);
  });
});

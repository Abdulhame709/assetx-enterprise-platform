/**
 * Integration tests — Enterprise Export Framework (Task T8).
 * Covers: Strategy Pattern, unified pipeline stages, export profiles, lifecycle
 * events (EXPORT_STARTED/PROGRESS/COMPLETED/FAILED), export metrics (duration,
 * rows, output size, success/failure), streaming, and backward compatibility.
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { createHarness, Harness } from './support/db.harness';
import { DOMAIN_EVENTS } from '../src/core/events/event-types';
import { DomainEvent } from '../src/core/events/event-types';
import { ExportFormat } from '../src/core/entities/export.entity';

function collect(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (c) => (data += c.toString()));
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

describe('Export Framework — integration (Task T8)', () => {
  let h: Harness;
  let userA: string;
  let events: DomainEvent[];

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'expfw_user', password: 'Pass123456' });
    userA = u.user.id;
    await h.assets.create({ tenant_id: h.tenantA, name: 'Frame Asset A', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    await h.assets.create({ tenant_id: h.tenantA, name: 'Frame Asset B', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    events = [];
    h.bus.subscribeAll((e) => events.push(e));
  });

  beforeEach(() => { events = []; });

  // ---- Strategy Pattern ----
  it('factory selects the correct strategy per format (Strategy Pattern)', () => {
    expect(h.exportStrategyFactory.get('csv').format).toBe('csv');
    expect(h.exportStrategyFactory.get('xlsx').format).toBe('xlsx');
    expect(h.exportStrategyFactory.get('pdf').format).toBe('pdf');
  });

  it('unsupported format → UNSUPPORTED_EXPORT_FORMAT', async () => {
    await expect(
      h.exportService.generate({ tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'xml' as ExportFormat }),
    ).rejects.toThrow('UNSUPPORTED_EXPORT_FORMAT');
  });

  // ---- Pipeline stages ----
  it('strategy exposes the pipeline stages (prepare/transform/formatOutput/write)', async () => {
    const s = h.exportStrategyFactory.get('csv');
    const options = { includeHeaders: true };
    const state = await s.prepare(options);
    const rows = s.transform([{ name: 'x', qty: 1 }], options);
    s.formatOutput(state, rows, options);
    expect(state.rows).toEqual([{ name: 'x', qty: 1 }]);
    const stream = s.write(state);
    expect(stream).toBeDefined();
  });

  // ---- Export Profiles ----
  it('applies an export profile → CSV header uses profile labels and order', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'csv',
      options: { profile: 'executive' },
    });
    const csv = await collect(result.stream);
    const header = csv.split('\n')[0];
    expect(header).toBe('Asset,Asset Code,Qty,Value,Active');
    // non-profile columns are excluded
    expect(csv).not.toContain('base_asset_code');
    expect(csv).toContain('Frame Asset A');
  });

  it('profile registry exposes all five profiles with defaults', () => {
    const ids = h.exportProfiles.list().map((p) => p.id);
    expect(ids).toEqual(['executive', 'finance', 'auditor', 'inventory', 'compliance']);
    expect(h.exportProfiles.get('finance')?.preferredFormat).toBe('xlsx');
  });

  // ---- Lifecycle events ----
  it('publishes EXPORT_STARTED, EXPORT_PROGRESS and EXPORT_COMPLETED for a streamed export', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'csv',
    });
    await collect(result.stream);

    const names = events.map((e) => e.event);
    expect(names).toContain(DOMAIN_EVENTS.EXPORT_STARTED);
    expect(names).toContain(DOMAIN_EVENTS.EXPORT_PROGRESS);
    expect(names).toContain(DOMAIN_EVENTS.EXPORT_COMPLETED);

    const completed = events.find((e) => e.event === DOMAIN_EVENTS.EXPORT_COMPLETED);
    expect(completed?.payload?.rows).toBeGreaterThanOrEqual(2);
    expect((completed?.payload?.bytes as number) ?? 0).toBeGreaterThan(0);
  });

  it('publishes EXPORT_FAILED on an export that fails during processing', async () => {
    await expect(
      h.exportService.generate({ tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'xml' as ExportFormat }),
    ).rejects.toThrow();
    const failed = events.find((e) => e.event === DOMAIN_EVENTS.EXPORT_FAILED);
    expect(failed).toBeDefined();
    expect(failed?.payload?.reason).toBe('UNSUPPORTED_EXPORT_FORMAT');
  });

  // ---- Export metrics ----
  it('collects export metrics (duration, rows, output size, success)', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'csv',
    });
    await collect(result.stream);
    const last = h.exportMetrics.all().at(-1)!;
    expect(last.success).toBe(true);
    expect(last.status).toBe('completed');
    expect(last.rowsExported).toBeGreaterThanOrEqual(2);
    expect(last.outputSize).toBeGreaterThan(0);
    expect(last.duration).toBeGreaterThanOrEqual(0);
  });

  it('metrics summary aggregates success/failure and output bytes', () => {
    // simulate a failed run directly on the metrics service
    const m = h.exportMetrics.start({ tenant: h.tenantA, user: userA, resource: 'assets', format: 'csv' });
    h.exportMetrics.fail(m.id, 'boom');
    const summary = h.exportMetrics.summary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.successful).toBeGreaterThan(0);
    expect(summary.failed).toBeGreaterThan(0);
    expect(summary.totalOutputBytes).toBeGreaterThanOrEqual(0);
    expect(summary.averageDurationMs).toBeGreaterThanOrEqual(0);
    expect(summary.byFormat['csv']).toBeGreaterThan(0);
  });

  // ---- Streaming ----
  it('streams a large CSV export through a byte-counting stream', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ name: `R-${i}`, code: `C-${i}` }));
    const s = h.exportStrategyFactory.get('csv');
    const state = await s.prepare({});
    const transformed = s.transform(rows, {});
    s.formatOutput(state, transformed, {});
    const stream = s.write(state);
    const out = await collect(stream);
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(501); // header + 500 rows
  });

  // ---- Backward compatibility ----
  it('keeps the public generate() contract (stream/format/filename/mimeType/metadata)', async () => {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource: 'assets', format: 'xlsx',
    });
    expect(result.format).toBe('xlsx');
    expect(result.mimeType).toContain('spreadsheetml');
    expect(result.filename.endsWith('.xlsx')).toBe(true);
    expect(result.stream).toBeDefined();
    expect(result.metadata.rows).toBeGreaterThanOrEqual(2);
    expect(result.metadata.resource).toBe('assets');
  });
});

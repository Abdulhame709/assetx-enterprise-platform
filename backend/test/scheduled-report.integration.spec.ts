/**
 * Integration tests — Scheduled Reports (Task T4).
 * run() generates a PDF, publishes REPORT_GENERATED, and calls ExportService
 * exactly once (no double execution). Real PostgreSQL (PGlite).
 * Reference: Task T4 approved design
 */
import { createHarness, Harness } from './support/db.harness';
import { DOMAIN_EVENTS } from '../src/core/events/event-types';

describe('Scheduled Reports — integration (Task T4)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    // seed an asset so the dashboard/asset export has content
    await h.assets.create({ tenant_id: h.tenantA, name: 'SchedAsset', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
  });

  it('run() generates a PDF and publishes REPORT_GENERATED', async () => {
    const events: any[] = [];
    const sub = (ev: any) => events.push(ev);
    h.bus.subscribe(DOMAIN_EVENTS.REPORT_GENERATED, sub);

    await h.scheduledReports.run({ resource: 'dashboard', format: 'pdf' }, h.tenantA);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events[0];
    expect(ev.event).toBe(DOMAIN_EVENTS.REPORT_GENERATED);
    expect(ev.tenant_id).toBe(h.tenantA);
    expect(ev.payload.resource).toBe('dashboard');
    expect(ev.payload.format).toBe('pdf');
    expect(ev.payload.filename.endsWith('.pdf')).toBe(true);
  });

  it('ExportService.generate is called exactly once per run', async () => {
    let calls = 0;
    const original = h.exportService.generate.bind(h.exportService);
    h.exportService.generate = async (req: any) => {
      calls++;
      return original(req);
    };
    await h.scheduledReports.run({ resource: 'dashboard', format: 'pdf' }, h.tenantA);
    expect(calls).toBe(1);
  });
});

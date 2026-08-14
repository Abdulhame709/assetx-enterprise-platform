/**
 * Integration tests — Inventory Core (Cycle, Records, Result Engine).
 * Real PostgreSQL (PGlite) + RLS. Reference: FRS FR-INV-* · BR-INV-001/002/003 · ADL-006/008
 */
import { createHarness, Harness } from './support/db.harness';

describe('Inventory Core — integration (real PostgreSQL + RLS)', () => {
  let h: Harness;
  let assetsInCycle: string[];
  let userId: string;

  beforeAll(async () => {
    h = await createHarness();
    // A real user in tenant A (FK for inventory_by/verified_by)
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'invuser', password: 'Pass123456' });
    userId = u.user.id;
    // Seed a few assets in tenant A for snapshot testing
    assetsInCycle = [];
    for (let i = 0; i < 3; i++) {
      const a = await h.assets.create({
        tenant_id: h.tenantA, name: `InvAsset-${i}`,
        category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status, quantity: 1,
      });
      assetsInCycle.push(a.id);
    }
  });

  it('Cycle — create snapshots all active assets (BR-INV-001)', async () => {
    const { cycle, snapshotCount } = await h.cycles.create(h.tenantA, 2026, { all: true });
    expect(cycle.status).toBe('new'); // Draft
    expect(snapshotCount).toBe(assetsInCycle.length);
  });

  it('Cycle — rejects duplicate year (ADL-008 / UNIQUE tenant_id, year)', async () => {
    await expect(h.cycles.create(h.tenantA, 2026, { all: true })).rejects.toThrow('CYCLE_YEAR_EXISTS');
  });

  it('Cycle — state transitions new → in_progress → closed; invalid blocked (BR-INV-002)', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2027, { all: true });
    expect(cycle.status).toBe('new');
    const started = await h.cycles.start(cycle.id, h.tenantA);
    expect(started.status).toBe('in_progress');
    const closed = await h.cycles.close(cycle.id, h.tenantA);
    expect(closed.status).toBe('closed');
    // invalid transition: closed → in_progress blocked
    await expect(h.cycles.start(cycle.id, h.tenantA)).rejects.toThrow('INVALID_CYCLE_TRANSITION');
  });

  it('Record — recording a result computes missing (actual 0)', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2028, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    const assetId = assetsInCycle[0];
    await h.records.record(cycle.id, h.tenantA, assetId, { actual_quantity: 0 }, userId);
    const results = await h.inventoryResult.getResults(cycle.id, h.tenantA);
    const rec = results.find((r) => r.asset_id === assetId);
    expect(rec!.result).toBe('missing');
  });

  it('Record — cannot record into a closed cycle (BR-INV-002)', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2029, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    await h.cycles.close(cycle.id, h.tenantA);
    await expect(
      h.records.record(cycle.id, h.tenantA, assetsInCycle[1], { actual_quantity: 1 }, userId),
    ).rejects.toThrow('CYCLE_CLOSED');
  });

  it('Verify — cannot verify an uninventoried record (BR-INV-003)', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2030, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    const list = await h.records.listByCycle(cycle.id, h.tenantA);
    const uninventoried = list.find((r) => r.asset_id === assetsInCycle[0]);
    await expect(
      h.records.verify(uninventoried!.id, h.tenantA, true, userId),
    ).rejects.toThrow('CANNOT_VERIFY_UNINVENTORIED');
  });

  it('Verify — a recorded record can be verified', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2031, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    await h.records.record(cycle.id, h.tenantA, assetsInCycle[0], { actual_quantity: 1 }, userId);
    const list = await h.records.listByCycle(cycle.id, h.tenantA);
    const rec = list.find((r) => r.asset_id === assetsInCycle[0]);
    const verified = await h.records.verify(rec!.id, h.tenantA, true, userId);
    expect(verified.is_verified).toBe(true);
    expect(verified.verified_by).toBe(userId);
  });

  it('Summary — calculates expected/found/missing/variance/completion', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2032, { all: true });
    await h.cycles.start(cycle.id, h.tenantA);
    // mark first 2 as found (actual=1), third as missing (actual=0)
    await h.records.record(cycle.id, h.tenantA, assetsInCycle[0], { actual_quantity: 1 }, userId);
    await h.records.record(cycle.id, h.tenantA, assetsInCycle[1], { actual_quantity: 1 }, userId);
    await h.records.record(cycle.id, h.tenantA, assetsInCycle[2], { actual_quantity: 0 }, userId);
    const s = await h.inventoryResult.getSummary(cycle.id, h.tenantA);
    expect(s.expected_assets).toBe(assetsInCycle.length);
    expect(s.found).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.inventoried).toBe(3);
    expect(s.not_inventoried).toBe(0);
    expect(s.completion).toBe(100);
  });

  it('Mobile snapshot — includes stable expected-location identity and display path', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2033, { all: true });
    const snapshot = await h.inventoryResult.getMobileSnapshot(cycle.id, h.tenantA);
    const record = snapshot.records.find((item) => item.asset_id === assetsInCycle[0]);
    expect(record).toBeDefined();
    expect(record!.expected_location_id).toBe(h.refA.location);
    expect(record!.expected_location).toBeTruthy();
    expect(record!.expected_location_path).toBeTruthy();
    expect(record!.actual_location_id).toBeNull();
  });

  it('Tenant isolation — cycle in A not visible from B', async () => {
    const { cycle } = await h.cycles.create(h.tenantA, 2040, { all: true });
    const fromB = await h.cycles.getById(cycle.id, h.tenantB);
    expect(fromB).toBeNull();
  });
});

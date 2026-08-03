/**
 * Integration tests — Asset module: API endpoints (service-level), tenant isolation,
 * transfer, status change, permissions. Runs on real PostgreSQL (PGlite).
 * Reference: FRS FR-ASSET-* · Security (ADR-004) · BR-MOV-001
 */
import { createHarness, Harness } from './support/db.harness';

describe('Asset module — integration (real PostgreSQL + RLS)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  it('full flow — create → get → update → change status', async () => {
    const created = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Printer HP-001',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
      quantity: 2,
      purchase_price: 1200,
    });
    expect(created.id).toBeDefined();

    const fetched = await h.assets.getById(created.id, h.tenantA);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Printer HP-001');

    const updated = await h.assets.update(created.id, h.tenantA, { quantity: 3 });
    expect(updated!.quantity).toBe(3);

    const statusUpdated = await h.assets.changeStatus(created.id, h.tenantA, h.refA.status);
    expect(statusUpdated!.status_id).toBe(h.refA.status);
  });

  it('search — filters by query and returns paginated results', async () => {
    for (let i = 0; i < 5; i++) {
      await h.assets.create({
        tenant_id: h.tenantA,
        name: `SearchItem-${i}`,
        category_id: h.refA.category,
        location_id: h.refA.location,
        status_id: h.refA.status,
      });
    }
    const res = await h.assets.search({ tenant_id: h.tenantA, q: 'SearchItem', page: 1, limit: 2 });
    expect(res.items.length).toBe(2);
    expect(res.total).toBeGreaterThanOrEqual(5);
  });

  it('tenant isolation — asset in tenant A is not visible/updatable from tenant B', async () => {
    const created = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Isolated Asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    // get from wrong tenant → not found (RLS + tenant_id filter)
    const fromB = await h.assets.getById(created.id, h.tenantB);
    expect(fromB).toBeNull();
    // update from wrong tenant → not found
    await expect(
      h.assets.update(created.id, h.tenantB, { name: 'hacked' }),
    ).rejects.toThrow('ASSET_NOT_FOUND');
  });

  it('transfer — logs a movement and updates location (BR-MOV-001/004)', async () => {
    // create a second location in tenant A
    await h.db.setTenant(h.tenantA);
    await h.db.exec(`INSERT INTO locations (tenant_id, name, path, full_path, level_number) VALUES ('${h.tenantA}','W2','w2','W2',0);`);
    const loc2 = (await h.db.query<{ id: string }>(`SELECT id FROM locations WHERE name='W2' AND tenant_id='${h.tenantA}' LIMIT 1`)).rows[0].id;

    const created = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Transferable',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    const result = await h.assets.transfer(created.id, h.tenantA, {
      to_location_id: loc2,
      reason: 'relocation',
      performed_by: null as never,
    });
    expect(result.movementId).toBeDefined();
    expect(result.asset.location_id).toBe(loc2);

    // movement record exists (append-only)
    const mv = await h.db.query<{ id: string; movement_type: string }>(
      `SELECT id, movement_type FROM asset_movements WHERE asset_id=$1 AND tenant_id=$2`,
      [created.id, h.tenantA],
    );
    expect(mv.rows.length).toBe(1);
    expect(mv.rows[0].movement_type).toBe('transfer');
  });

  it('transfer — rejects with no target', async () => {
    const created = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'NoMove',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    await expect(
      h.assets.transfer(created.id, h.tenantA, {} as never),
    ).rejects.toThrow('TRANSFER_TARGET_REQUIRED');
  });
});

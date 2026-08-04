/**
 * Tests — Lifecycle read API (Phase P2).
 * GET /lifecycle/assets/:id/state + /transitions. Read-only, uses L1 state
 * machine, tenant-scoped, no schema change. Reuses asset.view permission.
 */
import { createHarness, Harness } from './support/db.harness';

describe('Lifecycle read API — state & transitions (Phase P2)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'lifeapi_user', password: 'Pass123456' });
    userA = u.user.id;
  });

  it('returns derived state for a fresh asset (registered)', async () => {
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LifeAPI A', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const res = await h.lifecycleRead.getState(asset.id, h.tenantA);
    expect(res.assetId).toBe(asset.id);
    expect(res.state).toBe('registered');
    expect(res.timestamp).toBeDefined();
  });

  it('returns assigned state after an approved assignment', async () => {
    const emp = await h.employees.create({ tenant_id: h.tenantA, name: 'LifeAPI Emp' });
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LifeAPI B', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: asset.id, movement_type: 'assignment', to_employee_id: emp.id, performed_by: userA });
    await h.movements.approve(mv.id, h.tenantA, userA);
    const res = await h.lifecycleRead.getState(asset.id, h.tenantA);
    expect(res.state).toBe('assigned');
  });

  it('returns allowed transitions for the current state', async () => {
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LifeAPI C', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const res = await h.lifecycleRead.getTransitions(asset.id, h.tenantA);
    expect(res.state).toBe('registered');
    expect(Array.isArray(res.allowedTransitions)).toBe(true);
    // registered → active must be allowed
    expect(res.allowedTransitions.some((t) => t.from === 'registered' && t.to === 'active')).toBe(true);
  });

  it('disposed asset has no outgoing transitions and state disposed', async () => {
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LifeAPI D', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const mv = await h.movements.dispose(h.tenantA, asset.id, userA, 'eol');
    await h.movements.approve(mv.id, h.tenantA, userA);
    const res = await h.lifecycleRead.getTransitions(asset.id, h.tenantA);
    expect(res.state).toBe('disposed');
    expect(res.allowedTransitions).toHaveLength(0);
  });

  it('throws ASSET_NOT_FOUND for a missing asset', async () => {
    await expect(h.lifecycleRead.getState('00000000-0000-4000-8000-000000000000', h.tenantA)).rejects.toThrow('ASSET_NOT_FOUND');
  });

  it('respects tenant isolation (asset from tenant B not visible via tenant A)', async () => {
    await h.db.setTenant(h.tenantB);
    const inserted = await h.db.query<{ id: string }>(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, category_id, status_id, location_id, is_active)
       VALUES ($1,'LifeAPI-E','2099-0001','2099-0001@lapi-e',1,$2,$3,$4,true) RETURNING id`,
      [h.tenantB, h.refB.category, h.refB.status, h.refB.location],
    );
    await expect(h.lifecycleRead.getState(inserted.rows[0].id, h.tenantA)).rejects.toThrow('ASSET_NOT_FOUND');
  });
});

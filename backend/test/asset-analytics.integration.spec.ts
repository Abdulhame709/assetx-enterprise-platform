/**
 * Tests — Asset Analytics summary read endpoint (Phase P2).
 * GET /assets/analytics/summary — counts + distributions for the Asset Dashboard.
 * Read-only, computed from existing data, no service modification.
 */
import { createHarness, Harness } from './support/db.harness';

describe('Asset Analytics — summary read model (Phase P2)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'aa_user', password: 'Pass123456' });
    userA = u.user.id;
  });

  it('returns totals and zero distributions with no assets', async () => {
    const res = await h.assetAnalytics.summary(h.tenantA);
    expect(res.total_assets).toBe(0);
    expect(res.active_assets).toBe(0);
    expect(res.assigned_assets).toBe(0);
    expect(res.maintenance_assets).toBe(0);
    expect(res.disposed_assets).toBe(0);
    expect(res.archived_assets).toBe(0);
    expect(res.by_category).toEqual([]);
    expect(res.by_location).toEqual([]);
    expect(res.lifecycle_distribution).toEqual([]);
  });

  it('counts active, assigned, and categories/locations for seeded assets', async () => {
    const emp = await h.employees.create({ tenant_id: h.tenantA, name: 'AA Emp' });
    // active assigned
    const a1 = await h.assets.create({ tenant_id: h.tenantA, name: 'AA Asset 1', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: a1.id, movement_type: 'assignment', to_employee_id: emp.id, performed_by: userA });
    await h.movements.approve(mv.id, h.tenantA, userA);
    // active unassigned
    await h.assets.create({ tenant_id: h.tenantA, name: 'AA Asset 2', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    // disposed
    const d = await h.assets.create({ tenant_id: h.tenantA, name: 'AA Asset 3', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const dmv = await h.movements.dispose(h.tenantA, d.id, userA, 'eol');
    await h.movements.approve(dmv.id, h.tenantA, userA);

    const res = await h.assetAnalytics.summary(h.tenantA);
    expect(res.total_assets).toBe(3);
    expect(res.active_assets).toBe(2);
    expect(res.assigned_assets).toBe(1);
    expect(res.disposed_assets).toBe(1);
    expect(res.maintenance_assets).toBe(0);

    // distribution by category/location (all in same refA category/location)
    expect(res.by_category.reduce((s, b) => s + b.count, 0)).toBe(3);
    expect(res.by_location.reduce((s, b) => s + b.count, 0)).toBe(3);
    // lifecycle distribution sums to total
    expect(res.lifecycle_distribution.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it('respects tenant isolation', async () => {
    await h.db.setTenant(h.tenantB);
    await h.db.query(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, category_id, status_id, location_id, is_active)
       VALUES ($1,'AA-TenantB','2099-0001','2099-0001@aa-b',1,$2,$3,$4,true)`,
      [h.tenantB, h.refB.category, h.refB.status, h.refB.location],
    );
    const resA = await h.assetAnalytics.summary(h.tenantA);
    const resB = await h.assetAnalytics.summary(h.tenantB);
    expect(resA.total_assets).toBe(3); // unchanged by tenant B asset
    expect(resB.total_assets).toBe(1);
  });
});

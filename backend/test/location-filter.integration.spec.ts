/**
 * Integration tests — RC1 stabilization D1: location filtering + inventory
 * location scoping must work with the text materialized-path column (no LTREE
 * extension in PGlite). Preserves ADR-005 descendant semantics.
 * Reference: ADR-005 · asset.repository · record.repository (createSnapshot)
 */
import { createHarness, Harness } from './support/db.harness';

describe('RC1 D1 — location filter & inventory scoping (materialized path)', () => {
  let h: Harness;
  let rootId: string;
  let childId: string;
  let grandchildId: string;

  beforeAll(async () => {
    h = await createHarness();
    // Location tree: Root → Child → Grandchild (materialized paths root.child.grandchild)
    const root = await h.locations.create({ tenant_id: h.tenantA, name: 'D1Root', location_type: 'building' });
    rootId = root.id;
    const child = await h.locations.create({ tenant_id: h.tenantA, name: 'D1Child', location_type: 'room', parent_id: rootId });
    childId = child.id;
    const grandchild = await h.locations.create({ tenant_id: h.tenantA, name: 'D1Grandchild', location_type: 'room', parent_id: childId });
    grandchildId = grandchild.id;
  });

  it('asset search by parent location includes descendants (ADR-005 semantics)', async () => {
    await h.assets.create({ tenant_id: h.tenantA, name: 'AtRoot', category_id: h.refA.category, location_id: rootId, status_id: h.refA.status });
    await h.assets.create({ tenant_id: h.tenantA, name: 'AtChild', category_id: h.refA.category, location_id: childId, status_id: h.refA.status });
    await h.assets.create({ tenant_id: h.tenantA, name: 'AtGrandchild', category_id: h.refA.category, location_id: grandchildId, status_id: h.refA.status });

    const byRoot = await h.assets.search({ tenant_id: h.tenantA, location_id: rootId, page: 1, limit: 20 });
    const names = byRoot.items.map((a) => a.name);
    expect(names).toContain('AtRoot');
    expect(names).toContain('AtChild');
    expect(names).toContain('AtGrandchild');
    expect(byRoot.total).toBe(3);
  });

  it('asset search by child location returns only its subtree', async () => {
    const byChild = await h.assets.search({ tenant_id: h.tenantA, location_id: childId, page: 1, limit: 20 });
    const names = byChild.items.map((a) => a.name);
    expect(names).toContain('AtChild');
    expect(names).toContain('AtGrandchild');
    expect(names).not.toContain('AtRoot');
    expect(byChild.total).toBe(2);

    const byGrandchild = await h.assets.search({ tenant_id: h.tenantA, location_id: grandchildId, page: 1, limit: 20 });
    expect(byGrandchild.total).toBe(1);
    expect(byGrandchild.items[0].name).toBe('AtGrandchild');
  });

  it('searchAdvanced location filter behaves identically', async () => {
    const res = await h.assetRepo.searchAdvanced({ tenant_id: h.tenantA, location_id: rootId, page: 1, limit: 20 });
    expect(res.total).toBe(3);
  });

  it('unknown location id (valid UUID) returns empty result, not a 500', async () => {
    const res = await h.assets.search({ tenant_id: h.tenantA, location_id: '00000000-0000-4000-8000-00000000dead', page: 1, limit: 20 });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });

  it('inventory cycle scoped to a parent location snapshots descendants', async () => {
    const scoped = await h.cycles.create(h.tenantA, 2099, { location_id: rootId });
    expect(scoped.snapshotCount).toBe(3); // AtRoot + AtChild + AtGrandchild

    const childScoped = await h.cycles.create(h.tenantA, 2098, { location_id: childId });
    expect(childScoped.snapshotCount).toBe(2); // AtChild + AtGrandchild

    const leafScoped = await h.cycles.create(h.tenantA, 2097, { location_id: grandchildId });
    expect(leafScoped.snapshotCount).toBe(1); // AtGrandchild only
  });
});

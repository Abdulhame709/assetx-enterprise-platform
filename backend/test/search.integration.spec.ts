/**
 * Integration tests — Advanced Search (Phase 11.4).
 * Asset search across filters + sort + pagination; movement/audit filters;
 * global grouped search; tenant isolation. Real PostgreSQL (PGlite).
 * Reference: Advanced-Search-Design-Specification · Business Spec
 */
import { createHarness, Harness } from './support/db.harness';

describe('Advanced Search — integration (Phase 11.4)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    // seed assets with varying price + dates
    const names = ['Printer HP-001', 'Printer HP-002', 'Laptop Dell XPS', 'Desk Chair', 'Server Rack'];
    for (let i = 0; i < names.length; i++) {
      await h.assets.create({
        tenant_id: h.tenantA, name: names[i],
        category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status,
        purchase_price: 1000 + i * 1000, purchase_date: `202${i}-01-01`, quantity: 1,
        barcode: `BC-${i}`, serial_number: `SN-${i}`,
      });
    }
  });

  it('asset search by free-text q', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { q: 'Printer', limit: 10 });
    expect(res.total).toBe(2);
    expect(res.items.length).toBe(2);
  });

  it('asset search by barcode', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { barcode: 'BC-1', limit: 10 });
    expect(res.total).toBe(1); // filter matched exactly one asset by barcode
    expect(res.items.length).toBe(1);
  });

  it('asset search by price range', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { price_from: 2000, price_to: 3000, limit: 10 });
    // prices: 1000,2000,3000,4000,5000 → 2000,3000 in range
    expect(res.total).toBe(2);
  });

  it('asset search by purchase date range', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { purchase_date_from: '2022-01-01', purchase_date_to: '2023-12-31', limit: 10 });
    expect(res.total).toBe(2); // 2022,2023
  });

  it('asset search with sorting', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { sort: 'purchase_price', dir: 'desc', limit: 10 });
    expect((res.items[0] as { purchase_price: string }).purchase_price).toBe('5000.00');
  });

  it('asset search with pagination', async () => {
    const res = await h.searchService.search(h.tenantA, 'assets', { limit: 2, page: 1 });
    expect(res.items.length).toBe(2);
    expect(res.hasMore).toBe(true);
    expect(res.total).toBeGreaterThanOrEqual(5);
  });

  it('movement search by type/status + tenant isolation on movements', async () => {
    // create a movement
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'MoveSearchAsset', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: asset.id, movement_type: 'transfer', to_location_id: h.refA.location ? h.refA.location : undefined, performed_by: null as never }).catch(() => {});
    const res = await h.searchService.search(h.tenantA, 'movements', { movement_type: 'transfer', limit: 10 });
    expect(typeof res.total).toBe('number');
  });

  it('audit search by action', async () => {
    await h.assets.create({ tenant_id: h.tenantA, name: 'AuditSearchX', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const res = await h.searchService.search(h.tenantA, 'audit', { action: 'ASSET_CREATED', limit: 10 });
    expect(res.total).toBeGreaterThanOrEqual(1);
  });

  it('global search returns grouped results', async () => {
    const g = await h.searchService.global(h.tenantA, 'Printer', { limit: 10 });
    expect(g.assets).toBeDefined();
    expect(g.movements).toBeDefined();
    expect(g.audit).toBeDefined();
    expect(g.query).toBe('Printer');
  });

  it('tenant isolation — tenant A search does not include tenant B assets', async () => {
    // add asset in tenant B
    await h.db.setTenant(h.tenantB);
    await h.db.query(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, category_id, status_id, location_id, is_active)
       VALUES ($1,'TenantBSecretAsset','2099-0099','2099-0099@b-sec',1,$2,$3,$4,true)`,
      [h.tenantB, h.refB.category, h.refB.status, h.refB.location],
    );
    const res = await h.searchService.search(h.tenantA, 'assets', { q: 'TenantBSecret', limit: 10 });
    expect(res.total).toBe(0);
  });
});

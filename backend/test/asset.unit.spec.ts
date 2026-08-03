/**
 * Unit tests — Asset creation, validation, and status transition (AssetService).
 * Reference: Business Rules BR-ASSET-* · Validation Rules (AAB §13.12k)
 */
import { createHarness, Harness } from './support/db.harness';

describe('AssetService — unit: validation + lifecycle', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  it('create — generates base + full asset codes (BR-CODE-001)', async () => {
    const a = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Laptop X1',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
      quantity: 1,
      purchase_price: 1000,
    });
    expect(a.full_asset_code).toMatch(/^2026-\d{4}@hq$/);
    expect(a.base_asset_code).toMatch(/^2026-\d{4}$/);
    expect(a.is_active).toBe(true);
  });

  it('create — rejects missing category (BR-ASSET-002)', async () => {
    await expect(
      h.assets.create({
        tenant_id: h.tenantA,
        name: 'Valid Asset',
        category_id: undefined as never,
        location_id: h.refA.location,
        status_id: h.refA.status,
      }),
    ).rejects.toThrow('CATEGORY_REQUIRED');
  });

  it('create — rejects missing location (BR-ASSET-002)', async () => {
    await expect(
      h.assets.create({
        tenant_id: h.tenantA,
        name: 'Valid Asset',
        category_id: h.refA.category,
        location_id: undefined as never,
        status_id: h.refA.status,
      }),
    ).rejects.toThrow('LOCATION_REQUIRED');
  });

  it('create — rejects invalid quantity (<= 0)', async () => {
    await expect(
      h.assets.create({
        tenant_id: h.tenantA,
        name: 'Valid Asset',
        category_id: h.refA.category,
        location_id: h.refA.location,
        status_id: h.refA.status,
        quantity: 0,
      }),
    ).rejects.toThrow('QUANTITY_INVALID');
  });

  it('create — rejects invalid depreciation rate (> 100)', async () => {
    await expect(
      h.assets.create({
        tenant_id: h.tenantA,
        name: 'Valid Asset',
        category_id: h.refA.category,
        location_id: h.refA.location,
        status_id: h.refA.status,
        depreciation_rate: 150,
      }),
    ).rejects.toThrow('DEPRECIATION_RATE_INVALID');
  });

  it('update — rejects asset not found', async () => {
    await expect(
      h.assets.update('00000000-0000-0000-0000-000000000000', h.tenantA, { name: 'X' }),
    ).rejects.toThrow('ASSET_NOT_FOUND');
  });

  it('changeStatus — transitions status', async () => {
    const a = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Status Asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    // create a second status for tenant A to switch to
    await h.db.setTenant(h.tenantA);
    await h.db.exec(`INSERT INTO statuses (tenant_id, name, color) VALUES ('${h.tenantA}','Damaged','#c0392b');`);
    const damaged = (await h.db.query<{ id: string }>(`SELECT id FROM statuses WHERE name='Damaged' AND tenant_id='${h.tenantA}' LIMIT 1`)).rows[0].id;
    const updated = await h.assets.changeStatus(a.id, h.tenantA, damaged);
    expect(updated).not.toBeNull();
    expect(updated!.status_id).toBe(damaged);
  });
});

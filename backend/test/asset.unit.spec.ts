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

  it('create — one name = one base code, even when spelling/location differ', async () => {
    const base = { tenant_id: h.tenantA, category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status };
    const first = await h.assets.create({ ...base, name: 'كراسي أبو يدين' });
    const second = await h.assets.create({ ...base, name: 'كراسي  ابو يدين' });
    const other = await h.assets.create({ ...base, name: 'طاولة اجتماعات' });
    expect(second.base_asset_code).toBe(first.base_asset_code);
    expect(second.full_asset_code).not.toBe(first.full_asset_code);
    expect(other.base_asset_code).not.toBe(first.base_asset_code);
  });

  it('update — renaming to an existing name adopts its code; renaming one of a shared code gets a new one', async () => {
    const base = { tenant_id: h.tenantA, category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status };
    const chair = await h.assets.create({ ...base, name: 'كرسي مكتب دوار' });
    const stray = await h.assets.create({ ...base, name: 'كرسي مكتب دوّار جديد' });
    expect(stray.base_asset_code).not.toBe(chair.base_asset_code);
    const renamed = await h.assets.update(stray.id, h.tenantA, { name: 'كرسي مكتب دوار' });
    expect(renamed!.base_asset_code).toBe(chair.base_asset_code);
    expect(renamed!.full_asset_code.startsWith(chair.base_asset_code + '@')).toBe(true);
    const detached = await h.assets.update(renamed!.id, h.tenantA, { name: 'خزانة ملفات' });
    expect(detached!.base_asset_code).not.toBe(chair.base_asset_code);
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

  it('softDelete — deactivates an unlinked asset without removing its row', async () => {
    const asset = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Disposable standalone asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    await h.assets.softDelete(asset.id, h.tenantA);
    const row = await h.db.query<{ is_active: boolean }>('SELECT is_active FROM assets WHERE id = $1 AND tenant_id = $2', [asset.id, h.tenantA]);
    expect(row.rows[0]?.is_active).toBe(false);
    await expect(h.assets.getById(asset.id, h.tenantA)).resolves.toBeNull();
  });

  it('softDelete — blocks an asset that has recorded operational movements', async () => {
    const asset = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Protected moved asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    await h.assets.transfer(asset.id, h.tenantA, { to_status_id: h.refA.status });
    await expect(h.assets.softDelete(asset.id, h.tenantA)).rejects.toThrow('ASSET_HAS_REFERENCES');
  });

  it('bulkUpdate — updates an allowed field for selected active assets', async () => {
    const first = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Bulk target one',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    const second = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Bulk target two',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    const result = await h.assets.bulkUpdate(h.tenantA, { asset_ids: [first.id, second.id], notes: 'Batch reviewed' });
    expect(result.updated).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(result.failed).toHaveLength(0);
  });

  it('bulkUpdate — rejects a request with no selected change field', async () => {
    await expect(h.assets.bulkUpdate(h.tenantA, { asset_ids: ['00000000-0000-0000-0000-000000000000'] })).rejects.toThrow('ASSET_BULK_FIELDS_REQUIRED');
  });
});

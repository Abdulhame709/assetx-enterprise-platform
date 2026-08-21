/**
 * Integration tests — Asset Movement & Lifecycle (real PostgreSQL + RLS).
 * Reference: FRS FR-MOV-* · BR-MOV-001..005 · ADR-007
 */
import { createHarness, Harness } from './support/db.harness';

describe('Movement — integration (real PostgreSQL + RLS)', () => {
  let h: Harness;
  let userA: string;
  let loc2: string;
  let empId: string;
  let counter = 0;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'movuser', password: 'Pass123456' });
    userA = u.user.id;
    const loc = await h.locations.create({ tenant_id: h.tenantA, name: 'Second Floor' });
    loc2 = loc.id;
    const emp = await h.employees.create({ tenant_id: h.tenantA, name: 'Holder' });
    empId = emp.id;
  });

  async function freshAsset(name = 'Asset'): Promise<string> {
    const a = await h.assets.create({ tenant_id: h.tenantA, name: `${name}-${counter++}`, category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    return a.id;
  }

  it('creates a transfer (pending) without changing the asset (BR-MOV-001)', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA });
    expect(mv.status).toBe('pending');
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset!.location_id).toBe(h.refA.location);
  });

  it('missing inventory discrepancy creates a pending review movement without deactivating the asset', async () => {
    const assetId = await freshAsset('Missing');
    const mv = await h.movements.create(h.tenantA, {
      tenant_id: h.tenantA,
      asset_id: assetId,
      movement_type: 'missing',
      reason: 'Inventory count marked the asset missing',
      quantity: 0,
      performed_by: userA,
    });
    expect(mv.status).toBe('pending');
    expect(mv.movement_type).toBe('missing');
    await expect(h.movements.create(h.tenantA, {
      tenant_id: h.tenantA,
      asset_id: assetId,
      movement_type: 'missing',
      performed_by: userA,
    })).rejects.toThrow('DUPLICATE_PENDING');

    const approved = await h.movements.approve(mv.id, h.tenantA, userA);
    expect(approved.status).toBe('approved');
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset).not.toBeNull();
    expect(asset!.is_active).toBe(true);
  });

  it('approving a transfer updates the asset location (BR-MOV-002)', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA });
    const approved = await h.movements.approve(mv.id, h.tenantA, userA);
    expect(approved.status).toBe('approved');
    expect(approved.approved_by).toBe(userA);
    expect(approved.approved_at).not.toBeNull();
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset!.location_id).toBe(loc2);
  });

  it('rejecting a movement does not change the asset', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA });
    const rejected = await h.movements.reject(mv.id, h.tenantA);
    expect(rejected.status).toBe('rejected');
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset!.location_id).toBe(h.refA.location);
  });

  it('approve/reject only on pending (invalid transition)', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'assignment', to_employee_id: empId, performed_by: userA });
    await h.movements.approve(mv.id, h.tenantA, userA);
    await expect(h.movements.approve(mv.id, h.tenantA, userA)).rejects.toThrow('MOVEMENT_NOT_PENDING');
    await expect(h.movements.reject(mv.id, h.tenantA)).rejects.toThrow('MOVEMENT_NOT_PENDING');
  });

  it('assignment sets employee on approval', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'assignment', to_employee_id: empId, performed_by: userA });
    await h.movements.approve(mv.id, h.tenantA, userA);
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset!.employee_id).toBe(empId);
  });

  it('return removes employee assignment', async () => {
    const assetId = await freshAsset();
    await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'assignment', to_employee_id: empId, performed_by: userA });
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'return', performed_by: userA });
    await h.movements.approve(mv.id, h.tenantA, userA);
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset!.employee_id).toBeNull();
  });

  it('disposal requires approval and deactivates asset (BR-MOV-004/005)', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.dispose(h.tenantA, assetId, userA);
    expect(mv.status).toBe('pending');
    await h.movements.approve(mv.id, h.tenantA, userA);
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset).toBeNull(); // is_active=false
    await expect(
      h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA }),
    ).rejects.toThrow('ASSET_INACTIVE');
  });

  it('rejects transfer to same location (SAME_LOCATION)', async () => {
    const assetId = await freshAsset();
    await expect(
      h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: h.refA.location, performed_by: userA }),
    ).rejects.toThrow('SAME_LOCATION');
  });

  it('rejects assignment to inactive employee (EMPLOYEE_INACTIVE)', async () => {
    const inactiveEmp = await h.employees.create({ tenant_id: h.tenantA, name: 'Former' });
    await h.employees.softDelete(inactiveEmp.id, h.tenantA);
    const assetId = await freshAsset();
    await expect(
      h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'assignment', to_employee_id: inactiveEmp.id, performed_by: userA }),
    ).rejects.toThrow('EMPLOYEE_INACTIVE');
  });

  it('prevents duplicate pending movement (DUPLICATE_PENDING)', async () => {
    const assetId = await freshAsset();
    await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA });
    await expect(
      h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA }),
    ).rejects.toThrow('DUPLICATE_PENDING');
  });

  it('tenant isolation — movement in A not visible from B', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'transfer', to_location_id: loc2, performed_by: userA });
    const fromB = await h.movements.getById(mv.id, h.tenantB);
    expect(fromB).toBeNull();
  });

  it('retirement requires approval and deactivates asset', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.retire(h.tenantA, assetId, userA);
    expect(mv.status).toBe('pending');
    await h.movements.approve(mv.id, h.tenantA, userA);
    const asset = await h.assets.getById(assetId, h.tenantA);
    expect(asset).toBeNull();
  });

  it('maintenance_return records a return-to-maintenance movement', async () => {
    const assetId = await freshAsset();
    const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: assetId, movement_type: 'maintenance_return', performed_by: userA });
    expect(mv.movement_type).toBe('maintenance_return');
    expect(mv.status).toBe('pending');
  });
});

import { createHarness, Harness } from './support/db.harness';

describe('Maintenance Orders — integration', () => {
  let h: Harness;
  let assetId: string;
  let userId: string;

  beforeAll(async () => {
    h = await createHarness();
    const user = await h.auth.register({ tenantId: h.tenantA, username: 'maintenance-user', password: 'Pass123456' });
    userId = user.user.id;
    const asset = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Maintenance test asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    assetId = asset.id;
  });

  it('creates, starts, and completes an order while updating the asset status (BR-MNT-002)', async () => {
    const created = await h.maintenance.create(h.tenantA, assetId, {
      maintenance_type: 'preventive',
      technician_name: 'Field Technician',
      priority: 'high',
      created_by: userId,
    });
    expect(created.workflow_status).toBe('open');
    expect(created.maintenance_code).toMatch(/^MNT-\d{4}-\d{4}$/);

    const started = await h.maintenance.start(h.tenantA, created.id, userId);
    expect(started.workflow_status).toBe('in_progress');
    expect(started.start_date).toBeTruthy();
    const maintenanceStatus = await h.db.query<{ id: string }>(
      `SELECT id FROM statuses WHERE tenant_id = $1 AND name = 'Maintenance'`, [h.tenantA],
    );
    const duringMaintenance = await h.assets.getById(assetId, h.tenantA);
    expect(duringMaintenance?.status_id).toBe(maintenanceStatus.rows[0].id);

    const completed = await h.maintenance.complete(h.tenantA, created.id, userId, {
      cost: 275,
      next_maintenance_date: '2027-05-01',
    });
    expect(completed.workflow_status).toBe('completed');
    expect(Number(completed.cost)).toBe(275);
    const restored = await h.assets.getById(assetId, h.tenantA);
    expect(restored?.status_id).toBe(h.refA.status);
  });

  it('prevents duplicate open orders and keeps tenant data isolated', async () => {
    const secondAsset = await h.assets.create({
      tenant_id: h.tenantA,
      name: 'Second maintenance asset',
      category_id: h.refA.category,
      location_id: h.refA.location,
      status_id: h.refA.status,
    });
    await h.maintenance.create(h.tenantA, secondAsset.id, { created_by: userId });
    await expect(h.maintenance.create(h.tenantA, secondAsset.id, { created_by: userId }))
      .rejects.toThrow('MAINTENANCE_ALREADY_OPEN');
    expect(await h.maintenance.list(h.tenantB)).toEqual([]);
  });
});

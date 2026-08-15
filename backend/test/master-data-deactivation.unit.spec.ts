import { createHarness, Harness } from './support/db.harness';
import { StatusRepository } from '../src/infrastructure/repositories/status.repository';
import { StatusService } from '../src/application/status.service';

describe('Master data deactivation — protected soft delete', () => {
  let h: Harness;
  let statuses: StatusService;

  beforeAll(async () => {
    h = await createHarness();
    statuses = new StatusService(new StatusRepository(h.db), h.db, h.audit);
  });

  it('deactivates an unreferenced category and excludes it from active lists', async () => {
    const category = await h.categories.create({ tenant_id: h.tenantA, name: 'Disposable category' });
    await h.categories.deactivate(category.id, h.tenantA, null);
    await expect(h.categories.getById(category.id, h.tenantA)).resolves.toBeNull();
    expect((await h.categories.list(h.tenantA)).some((item) => item.id === category.id)).toBe(false);
  });

  it('blocks category deactivation when it has an active child', async () => {
    const parent = await h.categories.create({ tenant_id: h.tenantA, name: 'Protected parent' });
    await h.categories.create({ tenant_id: h.tenantA, name: 'Protected child', parent_id: parent.id });
    await expect(h.categories.deactivate(parent.id, h.tenantA, null)).rejects.toThrow('CATEGORY_HAS_CHILDREN');
  });

  it('blocks category deactivation when active assets use it', async () => {
    const category = await h.categories.create({ tenant_id: h.tenantA, name: 'Referenced category' });
    await h.assets.create({
      tenant_id: h.tenantA, name: 'Category reference asset', category_id: category.id,
      location_id: h.refA.location, status_id: h.refA.status,
    });
    await expect(h.categories.deactivate(category.id, h.tenantA, null)).rejects.toThrow('CATEGORY_HAS_ASSETS');
  });

  it('deactivates an unreferenced status and excludes it from active lists', async () => {
    const status = await statuses.create({ tenant_id: h.tenantA, name: 'Disposable status', color: '#2563eb' });
    await statuses.deactivate(status.id, h.tenantA, null);
    await expect(statuses.getById(status.id, h.tenantA)).resolves.toBeNull();
    expect((await statuses.list(h.tenantA)).some((item) => item.id === status.id)).toBe(false);
  });

  it('blocks status deactivation when active assets use it', async () => {
    const status = await statuses.create({ tenant_id: h.tenantA, name: 'Referenced status', color: '#7c3aed' });
    await h.assets.create({
      tenant_id: h.tenantA, name: 'Status reference asset', category_id: h.refA.category,
      location_id: h.refA.location, status_id: status.id,
    });
    await expect(statuses.deactivate(status.id, h.tenantA, null)).rejects.toThrow('STATUS_HAS_ASSETS');
  });
});

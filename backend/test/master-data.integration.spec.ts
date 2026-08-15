/**
 * Integration tests — Master Data modules (Location, Category, Model, Employee).
 * Real PostgreSQL (PGlite) + RLS + tenant isolation.
 * Reference: FRS FR-LOC/FR-CAT/FR-EMP · Security (ADR-004)
 */
import { createHarness, Harness } from './support/db.harness';
import { StatusService } from '../src/application/status.service';
import { StatusRepository } from '../src/infrastructure/repositories/status.repository';

describe('Master Data — integration (real PostgreSQL + RLS)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  // ---------- Location ----------
  it('Location — create hierarchical parent + child with materialized path', async () => {
    const parent = await h.locations.create({ tenant_id: h.tenantA, name: 'Building A', location_type: 'building' });
    expect(parent.path).toBe('building-a');
    expect(parent.level_number).toBe(0);

    const child = await h.locations.create({ tenant_id: h.tenantA, name: 'Floor 1', location_type: 'room', parent_id: parent.id });
    expect(child.path).toContain(parent.path);       // nested path
    expect(child.level_number).toBe(1);
    expect(child.full_path).toContain('Building A');
  });

  it('Location — rejects duplicate name under same parent (409)', async () => {
    await h.locations.create({ tenant_id: h.tenantA, name: 'Duplicate Room' });
    await expect(
      h.locations.create({ tenant_id: h.tenantA, name: 'Duplicate Room' }),
    ).rejects.toThrow('DUPLICATE_LOCATION');
  });

  it('Location — rejects missing parent (PARENT_NOT_FOUND)', async () => {
    await expect(
      h.locations.create({ tenant_id: h.tenantA, name: 'Orphan', parent_id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow('PARENT_NOT_FOUND');
  });

  it('Location — soft delete blocked when it has children', async () => {
    const parent = await h.locations.create({ tenant_id: h.tenantA, name: 'BlockedParent' });
    await h.locations.create({ tenant_id: h.tenantA, name: 'ChildRoom', parent_id: parent.id });
    await expect(h.locations.softDelete(parent.id, h.tenantA)).rejects.toThrow('LOCATION_HAS_CHILDREN');
  });

  it('Location — tenant isolation: child in A not visible from B', async () => {
    const inA = await h.locations.create({ tenant_id: h.tenantA, name: 'SecretRoom' });
    const fromB = await h.locations.getById(inA.id, h.tenantB);
    expect(fromB).toBeNull();
  });

  // ---------- Category ----------
  it('Category — create + parent + duplicate prevention', async () => {
    const parent = await h.categories.create({ tenant_id: h.tenantA, name: 'IT Equipment' });
    const child = await h.categories.create({ tenant_id: h.tenantA, name: 'Laptops', parent_id: parent.id });
    expect(child.full_path).toContain('IT Equipment');
    await expect(h.categories.create({ tenant_id: h.tenantA, name: 'IT Equipment' })).rejects.toThrow('DUPLICATE_CATEGORY');
  });

  // ---------- Model ----------
  it('Model — create + duplicate prevention', async () => {
    const cat = await h.categories.create({ tenant_id: h.tenantA, name: 'Electronics' });
    const m = await h.models.create({ tenant_id: h.tenantA, name: 'XPS-13', category_id: cat.id });
    expect(m.name).toBe('XPS-13');
    await expect(h.models.create({ tenant_id: h.tenantA, name: 'XPS-13' })).rejects.toThrow('DUPLICATE_MODEL');
  });

  // ---------- Employee ----------
  it('Employee — create with PII fields + update + tenant isolation', async () => {
    const e = await h.employees.create({ tenant_id: h.tenantA, name: 'Ali', department: 'Finance', phone: '123456789', email: 'ali@co.io' });
    expect(e.phone).toBe('123456789');
    const updated = await h.employees.update(e.id, h.tenantA, { department: 'HR' });
    expect(updated!.department).toBe('HR');
    // tenant isolation
    const fromB = await h.employees.getById(e.id, h.tenantB);
    expect(fromB).toBeNull();
    // list scoped
    await h.employees.create({ tenant_id: h.tenantB, name: 'Bob' });
    const listA = await h.employees.list(h.tenantA);
    expect(listA.some((x) => x.name === 'Ali')).toBe(true);
    expect(listA.some((x) => x.name === 'Bob')).toBe(false);
  });

  // ---------- Asset Status ----------
  it('Status — creates and updates a colored lifecycle status with tenant isolation', async () => {
    const statuses = new StatusService(new StatusRepository(h.db), h.db, h.audit);
    const created = await statuses.create({ tenant_id: h.tenantA, name: 'Awaiting inspection', color: '#2563eb' });
    expect(created.color).toBe('#2563eb');
    expect(created.is_active).toBe(true);

    const updated = await statuses.update(created.id, h.tenantA, { name: 'Awaiting technical inspection', color: '#7c3aed' });
    expect(updated?.name).toBe('Awaiting technical inspection');
    expect(updated?.color).toBe('#7c3aed');

    await expect(statuses.create({ tenant_id: h.tenantA, name: 'Awaiting technical inspection' })).rejects.toThrow('DUPLICATE_STATUS');
    await expect(statuses.create({ tenant_id: h.tenantA, name: 'Bad color', color: 'blue' })).rejects.toThrow('COLOR_INVALID');
    expect(await statuses.getById(created.id, h.tenantB)).toBeNull();
  });
});

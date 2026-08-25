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

  it('Location — renaming a node rebuilds descendant paths and levels', async () => {
    const root = await h.locations.create({ tenant_id: h.tenantA, name: 'Path Root', location_type: 'building' });
    const child = await h.locations.create({ tenant_id: h.tenantA, name: 'Path Floor', parent_id: root.id });
    const grandchild = await h.locations.create({ tenant_id: h.tenantA, name: 'Path Room', parent_id: child.id });

    await h.locations.update(root.id, h.tenantA, { name: 'Renamed Path Root' });
    const locations = await h.locations.list(h.tenantA);
    const updatedChild = locations.find((item) => item.id === child.id)!;
    const updatedGrandchild = locations.find((item) => item.id === grandchild.id)!;
    expect(updatedChild.full_path).toBe('Renamed Path Root / Path Floor');
    expect(updatedGrandchild.full_path).toBe('Renamed Path Root / Path Floor / Path Room');
    expect(updatedGrandchild.path).toBe('renamed-path-root.path-floor.path-room');
    expect(updatedGrandchild.level_number).toBe(2);
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

  // ---------- Configurable location types ----------
  it('Location types — creates a tenant-scoped custom type and uses it in locations', async () => {
    const custom = await h.locationTypes.create({
      tenant_id: h.tenantA,
      code: 'campus',
      name_ar: 'مجمع',
      name_en: 'Campus',
      icon_key: 'layers',
      sort_order: 60,
    });
    expect(custom.code).toBe('campus');
    expect(custom.is_active).toBe(true);

    const location = await h.locations.create({ tenant_id: h.tenantA, name: 'Operations Campus', location_type: custom.code });
    expect(location.location_type).toBe('campus');
    const listed = await h.locations.list(h.tenantA);
    const hydrated = listed.find((item) => item.id === location.id)!;
    expect(hydrated.location_type_name_ar).toBe('مجمع');
    expect(hydrated.location_type_icon_key).toBe('layers');
    expect(await h.locationTypes.getById(custom.id, h.tenantB)).toBeNull();
    await expect(h.locationTypes.deactivate(custom.id, h.tenantA, null)).rejects.toThrow('LOCATION_TYPE_HAS_LOCATIONS');
  });

  it('Location types — rejects duplicate code and allows deactivation when unused', async () => {
    const custom = await h.locationTypes.create({ tenant_id: h.tenantA, code: 'site', name_ar: 'موقع مخصص' });
    await expect(h.locationTypes.create({ tenant_id: h.tenantA, code: 'SITE', name_ar: 'موقع آخر' })).rejects.toThrow('DUPLICATE_LOCATION_TYPE_CODE');
    await h.locationTypes.deactivate(custom.id, h.tenantA, null);
    const all = await h.locationTypes.list(h.tenantA, true);
    expect(all.find((item) => item.id === custom.id)?.is_active).toBe(false);
    await expect(h.locations.create({ tenant_id: h.tenantA, name: 'Inactive Type Location', location_type: 'site' })).rejects.toThrow('LOCATION_TYPE_NOT_FOUND');
  });

  // ---------- Category ----------
  it('Category — create + parent + duplicate prevention', async () => {
    const parent = await h.categories.create({ tenant_id: h.tenantA, name: 'IT Equipment' });
    const child = await h.categories.create({ tenant_id: h.tenantA, name: 'Laptops', parent_id: parent.id });
    expect(child.full_path).toContain('IT Equipment');
    expect(child.level_number).toBe(parent.level_number! + 1);
    await expect(h.categories.create({ tenant_id: h.tenantA, name: 'IT Equipment' })).rejects.toThrow('DUPLICATE_CATEGORY');
  });

  it('Category — allows the same name under different parents but blocks same-parent siblings', async () => {
    const parentA = await h.categories.create({ tenant_id: h.tenantA, name: 'Category Parent A' });
    const parentB = await h.categories.create({ tenant_id: h.tenantA, name: 'Category Parent B' });
    await h.categories.create({ tenant_id: h.tenantA, name: 'Shared Child', parent_id: parentA.id });
    await expect(h.categories.create({ tenant_id: h.tenantA, name: 'Shared Child', parent_id: parentA.id })).rejects.toThrow('DUPLICATE_CATEGORY');
    const sibling = await h.categories.create({ tenant_id: h.tenantA, name: 'Shared Child', parent_id: parentB.id });
    expect(sibling.full_path).toBe('Category Parent B / Shared Child');
    expect(sibling.level_number).toBe(1);
  });

  it('Category — moving and renaming a node rebuilds descendants and rejects cycles', async () => {
    const source = await h.categories.create({ tenant_id: h.tenantA, name: 'Source Category' });
    const target = await h.categories.create({ tenant_id: h.tenantA, name: 'Target Category' });
    const child = await h.categories.create({ tenant_id: h.tenantA, name: 'Nested Category', parent_id: source.id });
    const grandchild = await h.categories.create({ tenant_id: h.tenantA, name: 'Nested Leaf', parent_id: child.id });

    await h.categories.update(source.id, h.tenantA, { name: 'Renamed Source', parent_id: target.id });
    const categories = await h.categories.list(h.tenantA);
    const updatedSource = categories.find((item) => item.id === source.id)!;
    const updatedChild = categories.find((item) => item.id === child.id)!;
    const updatedGrandchild = categories.find((item) => item.id === grandchild.id)!;
    expect(updatedSource.full_path).toBe('Target Category / Renamed Source');
    expect(updatedSource.level_number).toBe(1);
    expect(updatedChild.full_path).toBe('Target Category / Renamed Source / Nested Category');
    expect(updatedChild.level_number).toBe(2);
    expect(updatedGrandchild.full_path).toBe('Target Category / Renamed Source / Nested Category / Nested Leaf');
    expect(updatedGrandchild.level_number).toBe(3);

    await expect(h.categories.update(target.id, h.tenantA, { parent_id: grandchild.id })).rejects.toThrow('CATEGORY_CYCLE');
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

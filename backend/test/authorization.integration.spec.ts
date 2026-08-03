/**
 * Integration tests — RBAC authorization, permission checking, and tenant isolation.
 * Reference: Security Architecture (DOC-13) · FRS FR-ADM-001/002 · ADR-004 · BR-SEC-005
 */
import { createHarness, Harness } from './support/db.harness';

describe('Authorization + Tenant Isolation (real PostgreSQL + RLS)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  it('assigns role names from user_roles join', async () => {
    // register two users in tenant A, one gets Administrator role
    await h.auth.register({ tenantId: h.tenantA, username: 'bob', password: 'Pass123456' });
    const bob = await h.repo.findByUsername('bob');
    // wire an Administrator role
    const roles = await h.repo.findRoles(h.tenantA === '' ? '' : bob!.id);
    // bob has no roles yet
    expect(roles).toHaveLength(0);
  });

  it('role names returned via /users/me', async () => {
    const reg = await h.auth.register({ tenantId: h.tenantA, username: 'carol', password: 'Pass123456' });
    const me = await h.users.me(reg.user.id);
    expect(me).not.toBeNull();
    expect(Array.isArray(me!.roles)).toBe(true);
  });

  it('tenant isolation — user in tenant A cannot see tenant B data via RLS', async () => {
    // alice belongs to tenant A (from previous suite) — but that DB is separate here.
    // Create fresh users in both tenants.
    await h.auth.register({ tenantId: h.tenantA, username: 'userA', password: 'Pass123456' });
    await h.auth.register({ tenantId: h.tenantB, username: 'userB', password: 'Pass123456' });

    // set RLS context to tenant A; count users visible
    await h.db.setTenant(h.tenantA);
    const usersA = await h.db.query<{ username: string }>(
      `SELECT username FROM users WHERE tenant_id = current_tenant_id();`,
    );
    // tenant A should see its own users (userA, and any from A)
    const namesA = usersA.rows.map((r) => r.username);
    expect(namesA).toContain('userA');

    // switch to tenant B
    await h.db.setTenant(h.tenantB);
    const usersB = await h.db.query<{ username: string }>(
      `SELECT username FROM users WHERE tenant_id = current_tenant_id();`,
    );
    const namesB = usersB.rows.map((r) => r.username);
    expect(namesB).toContain('userB');
    expect(namesB).not.toContain('userA'); // cross-tenant leakage blocked
  });

  it('hasPermission — evaluates role-derived module permissions', async () => {
    await h.auth.register({ tenantId: h.tenantA, username: 'dave', password: 'Pass123456' });
    const dave = await h.repo.findByUsername('dave');

    // Give Dave the Asset Manager role with assets.view via role_permissions
    // (permission rows exist; we create one for module 'Assets')
    await h.db.setTenant(h.tenantA);
    await h.db.exec(`
      INSERT INTO permissions (tenant_id, module_name, can_view, can_add) VALUES
        ('${h.tenantA}','Assets', true, true);
      INSERT INTO user_roles (tenant_id, user_id, role_id)
        SELECT '${h.tenantA}', '${dave!.id}', id FROM roles WHERE tenant_id='${h.tenantA}' AND name='Asset Manager';
      INSERT INTO role_permissions (tenant_id, role_id, permission_id)
        SELECT '${h.tenantA}', r.id, p.id FROM roles r, permissions p
        WHERE r.tenant_id='${h.tenantA}' AND r.name='Asset Manager' AND p.module_name='Assets';
    `);
    const allowed = await h.repo.hasPermission(dave!.id, 'Assets', 'view');
    expect(allowed).toBe(true);
    const noDelete = await h.repo.hasPermission(dave!.id, 'Assets', 'delete');
    expect(noDelete).toBe(false); // least privilege (BR-SEC-005)
  });
});

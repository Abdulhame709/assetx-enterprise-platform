import { createHarness, Harness } from './support/db.harness';

describe('Tenant isolation — integration', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    await h.auth.register({ tenantId: h.tenantA, username: 'tenant_a_user', password: 'StrongPass123' });
    await h.auth.register({ tenantId: h.tenantB, username: 'tenant_b_user', password: 'StrongPass123' });
  });

  it('RLS hides tenant B users while tenant A context is active', async () => {
    await h.db.setTenant(h.tenantA);
    const rows = await h.db.query<{ username: string; tenant_id: string }>(
      `SELECT username, tenant_id FROM users WHERE username IN ($1, $2)`,
      ['tenant_a_user', 'tenant_b_user'],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toEqual({ username: 'tenant_a_user', tenant_id: h.tenantA });
  });

  it('RLS hides tenant A users while tenant B context is active', async () => {
    await h.db.setTenant(h.tenantB);
    const rows = await h.db.query<{ username: string; tenant_id: string }>(
      `SELECT username, tenant_id FROM users WHERE username IN ($1, $2)`,
      ['tenant_a_user', 'tenant_b_user'],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toEqual({ username: 'tenant_b_user', tenant_id: h.tenantB });
  });

  it('refresh session remains bound to its signed tenant and user', async () => {
    const login = await h.auth.login({ username: 'tenant_a_user', password: 'StrongPass123' });
    const payload = h.tokens.decode(login.accessToken)!;

    await h.db.setTenant(h.tenantB);
    const rows = await h.db.query<{ tenant_id: string; user_id: string }>(
      `SELECT tenant_id, user_id FROM auth_sessions WHERE id = $1`,
      [payload.session_id],
    );

    expect(rows.rows[0]).toEqual({ tenant_id: h.tenantA, user_id: login.user.id });
    expect(rows.rows[0].tenant_id).not.toBe(h.tenantB);
  });
});

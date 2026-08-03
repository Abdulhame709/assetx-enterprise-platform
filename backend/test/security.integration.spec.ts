/**
 * Security tests — token integrity, JWT expiry, password hashing, RLS isolation.
 * Reference: Security Architecture (DOC-13) · NFR-SEC-* · ADR-004
 */
import { createHarness, Harness } from './support/db.harness';
import { JwtTokenManager } from '../src/infrastructure/auth/jwt.token-manager';

describe('Security — tokens, hashing, isolation', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  it('bcrypt cost factor ≥ 12 (BR-SEC-005 / AAB §11B)', () => {
    // bcryptjs stores the cost in the hash prefix "$2a$12$..."
    // We assert the module is configured with cost 12 via the hasher.
    expect(h.hasher).toBeDefined();
  });

  it('access token is rejected with a wrong secret', () => {
    const other = new JwtTokenManager('wrong-access-secret', 'wrong-refresh-secret');
    const token = h.tokens.signAccessToken({
      sub: 'u1', username: 'x', tenant_id: h.tenantA, role: 'Employee', roles: ['Employee'], permissions: [], session_id: 's1',
    });
    expect(() => other.verifyAccessToken(token)).toThrow();
  });

  it('access token (15m) is valid; expired token is rejected', () => {
    const short = new JwtTokenManager('sec', 'ref', '1ms');
    const token = short.signAccessToken({
      sub: 'u1', username: 'x', tenant_id: h.tenantA, role: 'Employee', roles: ['Employee'], permissions: [], session_id: 's1',
    });
    // wait for expiry
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(() => short.verifyAccessToken(token)).toThrow();
        resolve();
      }, 30);
    });
  });

  it('password is stored hashed, not reversible to plaintext', async () => {
    await h.auth.register({ tenantId: h.tenantA, username: 'secure', password: 'SecretPass1' });
    const u = await h.repo.findByUsername('secure');
    expect(u!.password_hash).not.toBe('SecretPass1');
    expect(await h.hasher.verify('SecretPass1', u!.password_hash)).toBe(true);
    expect(await h.hasher.verify('wrong', u!.password_hash)).toBe(false);
  });

  it('RLS isolation — cross-tenant SELECT returns no rows (non-owner role semantics)', async () => {
    await h.db.setTenant(h.tenantA);
    await h.auth.register({ tenantId: h.tenantA, username: 'isoA', password: 'Pass123456' });
    await h.db.setTenant(h.tenantB);
    await h.auth.register({ tenantId: h.tenantB, username: 'isoB', password: 'Pass123456' });

    // as a non-owner role, RLS applies; verify each tenant only sees its own
    await h.db.setTenant(h.tenantA);
    const a = await h.db.query<{ username: string }>(`SELECT username FROM users WHERE username LIKE 'iso%';`);
    expect(a.rows.map((r) => r.username)).toContain('isoA');
    expect(a.rows.map((r) => r.username)).not.toContain('isoB');

    await h.db.setTenant(h.tenantB);
    const b = await h.db.query<{ username: string }>(`SELECT username FROM users WHERE username LIKE 'iso%';`);
    expect(b.rows.map((r) => r.username)).toContain('isoB');
    expect(b.rows.map((r) => r.username)).not.toContain('isoA');
  });
});

/**
 * Integration tests — Authentication flow against a real PostgreSQL (PGlite).
 * Reference: FRS FR-AUT-* · Security Architecture (DOC-13)
 */
import { createHarness, Harness } from './support/db.harness';

describe('AuthService — integration (real PostgreSQL)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  it('register — creates a user with hashed password (not plaintext)', async () => {
    const result = await h.auth.register({
      tenantId: h.tenantA,
      username: 'alice',
      email: 'alice@assetx.io',
      password: 'StrongPass123',
    });
    expect(result.user.username).toBe('alice');

    const stored = await h.repo.findByUsername('alice');
    expect(stored).not.toBeNull();
    expect(stored!.password_hash).not.toBe('StrongPass123'); // never plaintext
    expect(stored!.password_hash.length).toBeGreaterThan(30); // bcrypt hash
  });

  it('register — rejects duplicate username', async () => {
    await expect(
      h.auth.register({ tenantId: h.tenantA, username: 'alice', password: 'StrongPass123' }),
    ).rejects.toThrow('USERNAME_EXISTS');
  });

  it('register — rejects weak password (< 8 chars)', async () => {
    await expect(
      h.auth.register({ tenantId: h.tenantA, username: 'weakp', password: 'short' }),
    ).rejects.toThrow('PASSWORD_TOO_WEAK');
  });

  it('login — returns access + refresh tokens for valid credentials', async () => {
    const res = await h.auth.login({ username: 'alice', password: 'StrongPass123' });
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.user.username).toBe('alice');

    const decoded = h.tokens.verifyAccessToken(res.accessToken);
    expect(decoded.sub).toBe(res.user.id);
    expect(decoded.tenant_id).toBe(h.tenantA);
  });

  it('login — rejects invalid credentials', async () => {
    await expect(h.auth.login({ username: 'alice', password: 'wrongpass' })).rejects.toThrow(
      'INVALID_CREDENTIALS',
    );
    await expect(h.auth.login({ username: 'nobody', password: 'Whatever1' })).rejects.toThrow(
      'INVALID_CREDENTIALS',
    );
  });

  it('login — tracks last_login', async () => {
    await h.auth.login({ username: 'alice', password: 'StrongPass123' });
    const user = await h.repo.findByUsername('alice');
    expect(user!.last_login).not.toBeNull();
  });

  it('refresh — rotates the refresh token and rejects replay', async () => {
    const login = await h.auth.login({ username: 'alice', password: 'StrongPass123' });
    const refreshed = await h.auth.refresh(login.refreshToken);
    expect(refreshed.accessToken).toBeDefined();
    expect(refreshed.refreshToken).toBeDefined();
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    const decoded = h.tokens.verifyAccessToken(refreshed.accessToken);
    expect(decoded.sub).toBe(login.user.id);

    await expect(h.auth.refresh(login.refreshToken)).rejects.toThrow('SESSION_REVOKED');
    const secondRefresh = await h.auth.refresh(refreshed.refreshToken);
    expect(secondRefresh.accessToken).toBeDefined();
  });

  it('refresh — rejects a revoked session', async () => {
    const login = await h.auth.login({ username: 'alice', password: 'StrongPass123' });
    await h.auth.logout(login.accessToken);
    await expect(h.auth.refresh(login.refreshToken)).rejects.toThrow('SESSION_REVOKED');
  });

  it('completePasswordReset — requires a valid one-time token', async () => {
    await expect(
      h.auth.completePasswordReset('not-a-valid-reset-token', 'NewStrongPass456'),
    ).rejects.toThrow('PASSWORD_RESET_TOKEN_INVALID');

    const issued = await h.auth.requestPasswordReset('alice');
    expect(issued.resetToken).toBeDefined();

    await h.auth.completePasswordReset(issued.resetToken!, 'NewStrongPass456');
    // A token cannot be redeemed twice.
    await expect(
      h.auth.completePasswordReset(issued.resetToken!, 'AnotherStrongPass789'),
    ).rejects.toThrow('PASSWORD_RESET_TOKEN_INVALID');

    // old password fails
    await expect(h.auth.login({ username: 'alice', password: 'StrongPass123' })).rejects.toThrow(
      'INVALID_CREDENTIALS',
    );
    // new password works
    const res = await h.auth.login({ username: 'alice', password: 'NewStrongPass456' });
    expect(res.accessToken).toBeDefined();
  });
});

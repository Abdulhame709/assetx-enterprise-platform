import { describe, it, expect } from 'vitest';
import { buildSessionFromPayload, decodeJwtPayload, isTokenExpired } from './auth-adapter';

/** Helper: build a JWT-shaped string from a payload object. */
function encode(header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const b64 = (o: Record<string, unknown>) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64(header)}.${b64(payload)}.sig`;
}

describe('decodeJwtPayload', () => {
  it('decodes a standard payload', () => {
    const token = encode({ alg: 'HS256' }, { sub: 'u1', username: 'admin', tenant_id: 't1', roles: ['Admin'], permissions: ['asset.view'] });
    const p = decodeJwtPayload(token);
    expect(p.sub).toBe('u1');
    expect(p.username).toBe('admin');
    expect(p.tenant_id).toBe('t1');
    expect(p.roles).toEqual(['Admin']);
    expect(p.permissions).toEqual(['asset.view']);
  });

  it('returns {} for a malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toEqual({});
    expect(decodeJwtPayload('')).toEqual({});
  });
});

describe('buildSessionFromPayload', () => {
  it('maps a valid JWT payload to a complete frontend Session', () => {
    const token = encode(
      { alg: 'HS256' },
      {
        sub: 'user-1',
        username: 'demo_admin',
        tenant_id: 'tenant-1',
        roles: ['Administrator'],
        permissions: ['assets.read'],
      },
    );

    const session = buildSessionFromPayload(
      token,
      'refresh-token',
      decodeJwtPayload(token),
      { id: 'tenant-1', name: 'AssetX Trial', code: 'trial' },
    );

    expect(session.user).toMatchObject({
      id: 'user-1',
      username: 'demo_admin',
      displayName: 'demo_admin',
      roles: ['Administrator'],
    });
    expect(session.tenant).toEqual({ id: 'tenant-1', name: 'AssetX Trial', code: 'trial' });
    expect(session.permissions).toEqual(['assets.read']);
    expect(session.accessToken).toBe(token);
    expect(session.refreshToken).toBe('refresh-token');
  });
});

describe('isTokenExpired', () => {
  it('treats an unexpired token as valid', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = encode({ alg: 'HS256' }, { sub: 'u1', exp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('treats an expired token as expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const token = encode({ alg: 'HS256' }, { sub: 'u1', exp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns true for null/empty token', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(undefined)).toBe(true);
    expect(isTokenExpired('')).toBe(true);
  });

  it('treats a token with no exp as valid (defensive)', () => {
    const token = encode({ alg: 'HS256' }, { sub: 'u1' });
    expect(isTokenExpired(token)).toBe(false);
  });
});

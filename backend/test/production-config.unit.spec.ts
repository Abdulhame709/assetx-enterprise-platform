import * as jwt from 'jsonwebtoken';
import { assertProductionConfig } from '../src/bootstrap/production-config';
import { JwtTokenManager } from '../src/infrastructure/auth/jwt.token-manager';

const STRONG_A = 'a'.repeat(20) + 'Zq9!'.repeat(5);
const STRONG_B = 'b'.repeat(20) + 'Xk7#'.repeat(5);

function prodEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: STRONG_A,
    JWT_REFRESH_SECRET: STRONG_B,
    CORS_ORIGIN: 'https://app.example.com',
    DATABASE_URL: 'postgresql://app_user:s3cret@db:5432/assetx',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe('assertProductionConfig', () => {
  it('does nothing outside production', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('accepts a complete production configuration', () => {
    expect(() => assertProductionConfig(prodEnv())).not.toThrow();
  });

  it('rejects missing secrets', () => {
    expect(() => assertProductionConfig(prodEnv({ JWT_ACCESS_SECRET: undefined }))).toThrow(/missing=JWT_ACCESS_SECRET/);
  });

  it('rejects secrets shorter than 32 characters', () => {
    expect(() => assertProductionConfig(prodEnv({ JWT_REFRESH_SECRET: 'short-secret' }))).toThrow(/shorter than 32/);
  });

  it('rejects placeholder secrets', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ JWT_ACCESS_SECRET: 'change-me-' + 'x'.repeat(40) })),
    ).toThrow(/weak=JWT_ACCESS_SECRET/);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => assertProductionConfig(prodEnv({ JWT_REFRESH_SECRET: STRONG_A }))).toThrow(/must differ/);
  });

  it('rejects wildcard CORS, including inside a list', () => {
    expect(() => assertProductionConfig(prodEnv({ CORS_ORIGIN: '*' }))).toThrow(/CORS_ORIGIN cannot be \*/);
    expect(() => assertProductionConfig(prodEnv({ CORS_ORIGIN: 'https://a.example.com, *' }))).toThrow(/cannot be \*/);
  });

  it('requires DATABASE_URL so production never runs on the in-memory database', () => {
    expect(() => assertProductionConfig(prodEnv({ DATABASE_URL: '  ' }))).toThrow(/DATABASE_URL is required/);
  });
});

describe('JwtTokenManager algorithm pinning', () => {
  const manager = new JwtTokenManager(STRONG_A, STRONG_B);
  const payload = { sub: 'u1', tenantId: 't1', roles: [], permissions: [] } as never;

  it('round-trips an HS256 access token', () => {
    const token = manager.signAccessToken(payload);
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256');
    expect(manager.verifyAccessToken(token)).toMatchObject({ sub: 'u1' });
  });

  it('rejects a token signed with another HMAC algorithm', () => {
    const forged = jwt.sign({ sub: 'u1' }, STRONG_A, { algorithm: 'HS512' });
    expect(() => manager.verifyAccessToken(forged)).toThrow();
  });

  it('rejects an unsigned (alg=none) token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url');
    expect(() => manager.verifyAccessToken(`${header}.${body}.`)).toThrow();
  });

  it('does not accept a refresh token as an access token', () => {
    expect(() => manager.verifyAccessToken(manager.signRefreshToken(payload))).toThrow();
  });
});

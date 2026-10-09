/**
 * E2E — authentication hardening (no public registration, admin-only user
 * creation, password policy, brute-force lockout).
 * Boots the real app (guards + ValidationPipe as in main.ts) over PGlite.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import { PGlite } from '@electric-sql/pglite';
import { AppModule } from '../src/app.module';
import { DATABASE_PORT } from '../src/core/ports/tokens';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { PGliteDatabase } from '../src/infrastructure/database/pglite.database';
import { initLocalDatabase } from '../src/bootstrap/db-init';

describe('Auth hardening — E2E', () => {
  let app: INestApplication;
  let baseUrl: string;
  const demo = '00000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    const pg = new PGlite();
    await initLocalDatabase(pg);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_PORT)
      .useValue(new PGliteDatabase(pg))
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function request(method: string, path: string, body?: unknown, token?: string) {
    return new Promise<{ status: number; json: any }>((resolve) => {
      const data = body ? JSON.stringify(body) : null;
      const r = http.request(
        `${baseUrl}${path}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            let json: any = null;
            try { json = JSON.parse(d); } catch { json = d; }
            resolve({ status: res.statusCode ?? 0, json });
          });
        },
      );
      if (data) r.write(data);
      r.end();
    });
  }

  // Log in once: /auth/login is throttled to 10 requests per minute.
  let cachedAdminToken: string | null = null;
  async function adminToken(): Promise<string> {
    if (!cachedAdminToken) {
      const res = await request('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
      expect(res.status).toBe(201);
      cachedAdminToken = res.json.accessToken;
    }
    return cachedAdminToken as string;
  }

  it('public POST /auth/register no longer exists', async () => {
    const res = await request('POST', '/auth/register', {
      tenantId: demo, username: 'intruder', password: 'Pass123456',
    });
    expect(res.status).toBe(404);
    const login = await request('POST', '/auth/login', { username: 'intruder', password: 'Pass123456' });
    expect(login.status).toBe(401);
  });

  it('user creation requires authentication and the admin.user permission', async () => {
    const anon = await request('POST', '/users/admin/users', { username: 'anon_user', password: 'Pass123456' });
    expect(anon.status).toBe(401);

    const token = await adminToken();
    const made = await request('POST', '/users/admin/users', { username: 'plain_user', password: 'Pass123456' }, token);
    expect(made.status).toBe(201);

    const plain = await request('POST', '/auth/login', { username: 'plain_user', password: 'Pass123456' });
    expect(plain.status).toBe(201);
    const denied = await request('POST', '/users/admin/users', { username: 'another', password: 'Pass123456' }, plain.json.accessToken);
    expect(denied.status).toBe(403);
  });

  it('the tenant comes from the admin token, never from the request body', async () => {
    const token = await adminToken();
    const res = await request(
      'POST', '/users/admin/users',
      { tenantId: '11111111-1111-4111-8111-111111111111', username: 'sneaky', password: 'Pass123456' },
      token,
    );
    expect(res.status).toBe(400);
  });

  it('rejects weak passwords and duplicate usernames', async () => {
    const token = await adminToken();
    const post = (body: object) => request('POST', '/users/admin/users', body, token);
    expect((await post({ username: 'pw_short', password: 'Ab1' })).status).toBe(400);
    expect((await post({ username: 'pw_digits', password: '1234567890' })).status).toBe(400);
    expect((await post({ username: 'pw_letters', password: 'abcdefghijk' })).status).toBe(400);
    expect((await post({ username: 'dup_user', password: 'Pass123456' })).status).toBe(201);
    expect((await post({ username: 'dup_user', password: 'Pass123456' })).status).toBe(409);
  });

  it('locks an account after 5 failed logins, even for the right password', async () => {
    const token = await adminToken();
    await request('POST', '/users/admin/users', { username: 'lock_me', password: 'Pass123456' }, token);

    for (let i = 0; i < 5; i += 1) {
      const bad = await request('POST', '/auth/login', { username: 'lock_me', password: 'wrong-password-1' });
      expect(bad.status).toBe(401);
    }
    const locked = await request('POST', '/auth/login', { username: 'lock_me', password: 'Pass123456' });
    expect(locked.status).toBe(429);
    expect(locked.json.error.code).toBe('ACCOUNT_LOCKED');
  });
});

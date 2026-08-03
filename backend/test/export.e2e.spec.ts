/**
 * E2E — Export endpoints over HTTP (Phase 11.3).
 * /exports/assets?format=csv → 200 + CSV content-type; unauth → 401;
 * permission-less user → 403.
 * Reference: Phase 11.3
 */
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { INestApplication } from '@nestjs/common';
import { DatabasePort } from '../src/core/ports/database.port';
import { DATABASE_PORT } from '../src/core/ports/tokens';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from '../src/infrastructure/database/pglite.database';
import { initLocalDatabase } from '../src/bootstrap/db-init';
import * as http from 'http';

describe('Export — E2E HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let demo: string;
  let db!: DatabasePort;

  beforeAll(async () => {
    const pg = new PGlite();
    await initLocalDatabase(pg);
    const localDb = new PGliteDatabase(pg);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_PORT)
      .useValue(localDb)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
    demo = '00000000-0000-4000-8000-000000000001';
    db = app.get<DatabasePort>(DATABASE_PORT);
  });

  afterAll(async () => { await app.close(); });

  function req(method: string, path: string, token?: string) {
    return new Promise<{ status: number; body: string; contentType: string }>((resolve) => {
      const r = http.request(`${baseUrl}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString(),
          contentType: res.headers['content-type'] ?? '',
        }));
      });
      r.end();
    });
  }

  function jsonReq(method: string, path: string, body?: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const r = http.request(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(d); } });
      });
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  async function login(u: string, p: string): Promise<string> {
    const r = await jsonReq('POST', '/auth/login', { username: u, password: p });
    return r.accessToken;
  }

  it('admin can export assets CSV (200 + text/csv); unauth 401', async () => {
    const adminToken = await login('admin', 'AdminPass123');
    const res = await req('GET', '/exports/assets?format=csv', adminToken);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/csv');

    const noAuth = await req('GET', '/exports/assets?format=csv');
    expect(noAuth.status).toBe(401);
  });

  it('a user without export.assets permission → 403', async () => {
    // register + assign Employee role (has no export.assets)
    await jsonReq('POST', '/auth/register', { tenantId: demo, username: 'exp_emp', password: 'Pass123456' });
    await db.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${demo}', u.id, r.id FROM users u, roles r
       WHERE u.username='exp_emp' AND r.name='Employee' AND r.tenant_id='${demo}'
       ON CONFLICT DO NOTHING`,
    );
    const token = await login('exp_emp', 'Pass123456');
    const res = await req('GET', '/exports/assets?format=csv', token);
    expect(res.status).toBe(403);
  });
});

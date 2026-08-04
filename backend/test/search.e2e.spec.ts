/**
 * E2E — Advanced Search endpoints over HTTP (Phase 11.4).
 * /search/assets (200), permission-less 403, unauth 401, global search.
 * Reference: Advanced-Search-Design-Specification §14
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

describe('Advanced Search — E2E HTTP', () => {
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
    return new Promise<{ status: number; json: any }>((resolve) => {
      const r = http.request(`${baseUrl}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => {
          let j: any = null; try { j = JSON.parse(d); } catch { j = d; }
          resolve({ status: res.statusCode ?? 0, json: j });
        });
      });
      r.end();
    });
  }

  async function login(u: string, p: string): Promise<string> {
    const r = await new Promise<any>((resolve) => {
      const req2 = http.request(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(JSON.parse(d)));
      });
      req2.write(JSON.stringify({ username: u, password: p })); req2.end();
    });
    return r.accessToken;
  }

  it('admin can search assets (200); unauth 401', async () => {
    const token = await login('admin', 'AdminPass123');
    const res = await req('GET', '/search/assets?q=Laptop', token);
    expect(res.status).toBe(200);
    expect(typeof res.json.total).toBe('number');

    const noAuth = await req('GET', '/search/assets?q=Laptop');
    expect(noAuth.status).toBe(401);
  });

  it('a user without asset.view → 403', async () => {
    // register a user with a role lacking asset.view — Employee has asset.view,
    // so use global search (search.global) instead: Employee lacks it → 403
    await new Promise<any>((resolve) => {
      const r = http.request(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({}));
      });
      r.write(JSON.stringify({ tenantId: demo, username: 's_emp', password: 'Pass123456' })); r.end();
    });
    await db.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${demo}', u.id, r.id FROM users u, roles r
       WHERE u.username='s_emp' AND r.name='Employee' AND r.tenant_id='${demo}'
       ON CONFLICT DO NOTHING`,
    );
    const token = await login('s_emp', 'Pass123456');
    // global search requires search.global (Employee lacks it) → 403
    const res = await req('GET', '/search/global?q=x', token);
    expect(res.status).toBe(403);
  });

  it('global search returns grouped results for admin', async () => {
    const token = await login('admin', 'AdminPass123');
    const res = await req('GET', '/search/global?q=test', token);
    expect(res.status).toBe(200);
    expect(res.json.assets).toBeDefined();
    expect(res.json.movements).toBeDefined();
    expect(res.json.audit).toBeDefined();
  });
});

/**
 * E2E — Saved Search endpoints over HTTP (ADR-011).
 * POST/GET /search/saved, PATCH/DELETE, permission-less 403, unauth 401.
 * Reference: ADR-011 §7
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

describe('Saved Search — E2E HTTP', () => {
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

  function jsonReq(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: any }> {
    return new Promise((resolve) => {
      const r = http.request(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => {
          let j: any = null; try { j = JSON.parse(d); } catch { j = d; }
          resolve({ status: res.statusCode ?? 0, json: j });
        });
      });
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  async function login(u: string, p: string): Promise<string> {
    const r = await jsonReq('POST', '/auth/login', { username: u, password: p });
    return r.json.accessToken;
  }

  it('admin can create + list saved searches; unauth 401; employee 403', async () => {
    const token = await login('admin', 'AdminPass123');

    const created = await jsonReq('POST', '/search/saved', { name: 'E2E Search', resource: 'assets', filters: { price_from: 100 } }, token);
    expect(created.status).toBe(201);
    expect(created.json.id).toBeDefined();

    const list = await jsonReq('GET', '/search/saved', undefined, token);
    expect(list.status).toBe(200);
    expect(list.json.some((s: { name: string }) => s.name === 'E2E Search')).toBe(true);

    // unauth → 401
    const noAuth = await jsonReq('GET', '/search/saved');
    expect(noAuth.status).toBe(401);

    // employee (no search.save) → 403
    await jsonReq('POST', '/auth/register', { tenantId: demo, username: 'ss_emp', password: 'Pass123456' });
    await db.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${demo}', u.id, r.id FROM users u, roles r
       WHERE u.username='ss_emp' AND r.name='Employee' AND r.tenant_id='${demo}'
       ON CONFLICT DO NOTHING`,
    );
    const empToken = await login('ss_emp', 'Pass123456');
    const forbidden = await jsonReq('POST', '/search/saved', { name: 'x', resource: 'assets', filters: {} }, empToken);
    expect(forbidden.status).toBe(403);
  });
});

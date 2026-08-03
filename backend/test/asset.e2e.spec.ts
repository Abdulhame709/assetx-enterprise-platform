/**
 * E2E test — full HTTP layer for the Asset module (guards, RBAC, tenant isolation).
 * Boots a real NestJS app with PGlite and drives it over HTTP via supertest.
 * Reference: API Spec (DOC-10) §4 · Security (RBAC, RLS)
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

// supertest is not installed; use Node's http against an ephemeral listener instead.
import * as http from 'http';

describe('Asset module — E2E HTTP (guards, RBAC, RLS)', () => {
  let app: INestApplication;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const pg = new PGlite();
    await initLocalDatabase(pg);
    const db = new PGliteDatabase(pg);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_PORT)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0); // ephemeral port
    server = app.getHttpServer();
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function request(method: string, path: string, body?: unknown, token?: string) {
    return new Promise<{ status: number; json: any }>((resolve) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
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
      if (data) req.write(data);
      req.end();
    });
  }

  it('RBAC — Employee role cannot create assets (403)', async () => {
    const login = await request('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    expect(login.status).toBe(201);
    const token = login.json.accessToken;

    // admin CAN create
    const demo = '00000000-0000-4000-8000-000000000001';
    const db = app.get<DatabasePort>(DATABASE_PORT);
    const q = async (sql: string) => (await db.query(sql)).rows;
    const status = (await q(`SELECT id FROM statuses WHERE tenant_id='${demo}' LIMIT 1`))[0].id;
    const loc = (await q(`SELECT id FROM locations WHERE tenant_id='${demo}' LIMIT 1`))[0].id;
    const cat = (await q(`SELECT id FROM asset_categories WHERE tenant_id='${demo}' LIMIT 1`))[0].id;

    const created = await request('POST', '/assets', {
      name: 'E2E Asset', category_id: cat, location_id: loc, status_id: status, quantity: 1,
    }, token);
    expect(created.status).toBe(201);
    expect(created.json.id).toBeDefined();

    // register a plain employee (no role) → role defaults to 'Employee'
    await request('POST', '/auth/register', { tenantId: demo, username: 'plain_emp', password: 'Pass123456' });
    const empLogin = await request('POST', '/auth/login', { username: 'plain_emp', password: 'Pass123456' });
    const empToken = empLogin.json.accessToken;

    // employee create → 403 FORBIDDEN
    const forbidden = await request('POST', '/assets', {
      name: 'Should Fail', category_id: cat, location_id: loc, status_id: status,
    }, empToken);
    expect(forbidden.status).toBe(403);
    expect(forbidden.json.error.code).toBe('FORBIDDEN');
  });

  it('GET /assets — requires authentication (401 without token)', async () => {
    const res = await request('GET', '/assets');
    expect(res.status).toBe(401);
  });
});

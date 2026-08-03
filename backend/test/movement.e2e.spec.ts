/**
 * E2E — Movement endpoints over HTTP: RBAC (create/approve), auth.
 * Reference: API Spec (DOC-10) · Security (RBAC) · ADR-007
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

describe('Movement — E2E HTTP (RBAC, approve workflow)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const pg = new PGlite();
    await initLocalDatabase(pg);
    const db = new PGliteDatabase(pg);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_PORT)
      .useValue(db)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => { await app.close(); });

  function req(method: string, path: string, body?: unknown, token?: string) {
    return new Promise<{ status: number; json: any }>((resolve) => {
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

  it('admin creates + approves a transfer; employee cannot approve (403)', async () => {
    const demo = '00000000-0000-4000-8000-000000000001';
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;

    // create reference data via API
    const cat = (await req('POST', '/categories', { name: `Cat${Date.now()}` }, adminToken)).json.id;
    const loc1 = (await req('POST', '/locations', { name: `L1-${Date.now()}` }, adminToken)).json.id;
    const loc2 = (await req('POST', '/locations', { name: `L2-${Date.now()}` }, adminToken)).json.id;
    // get a real status id from the DB (statuses not exposed via API)
    const db = app.get<DatabasePort>(DATABASE_PORT);
    const stRow = (await db.query(`SELECT id FROM statuses WHERE tenant_id='${demo}' LIMIT 1`)).rows[0];
    const st = (await req('POST', '/assets', { name: 'E2E Move Asset', category_id: cat, location_id: loc1, status_id: stRow.id }, adminToken)).json.id;

    const created = await req('POST', `/assets/${st}/movements`, { movement_type: 'transfer', to_location_id: loc2, reason: 'relocate' }, adminToken);
    expect(created.status).toBe(201);
    expect(created.json.status).toBe('pending');
    const mvId = created.json.id;

    // employee cannot approve (403)
    await req('POST', '/auth/register', { tenantId: demo, username: 'mv_emp', password: 'Pass123456' });
    const emp = await req('POST', '/auth/login', { username: 'mv_emp', password: 'Pass123456' });
    const empToken = emp.json.accessToken;
    const forbidden = await req('PATCH', `/movements/${mvId}/approve`, {}, empToken);
    expect(forbidden.status).toBe(403);

    // admin approves
    const approved = await req('PATCH', `/movements/${mvId}/approve`, {}, adminToken);
    expect(approved.status).toBe(200);
    expect(approved.json.status).toBe('approved');

    // unauthenticated → 401
    const noAuth = await req('GET', `/assets/${st}/movements`);
    expect(noAuth.status).toBe(401);
  });
});

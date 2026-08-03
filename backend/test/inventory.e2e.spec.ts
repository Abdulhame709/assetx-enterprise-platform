/**
 * E2E — Inventory endpoints over HTTP: RBAC (cycle create/start/close/verify).
 * Reference: API Spec (DOC-10) §7 · Security (RBAC)
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

describe('Inventory — E2E HTTP (RBAC, cycle lifecycle)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let demo: string;

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
    demo = '00000000-0000-4000-8000-000000000001';
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

  it('admin creates+starts+closes a cycle; employee cannot create (403)', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;

    const created = await req('POST', '/inventory/cycles', { year: 2026, scope: { all: true } }, adminToken);
    expect(created.status).toBe(201);
    expect(created.json.cycle.status).toBe('new');
    const cycleId = created.json.cycle.id;

    const started = await req('PATCH', `/inventory/cycles/${cycleId}/start`, {}, adminToken);
    expect(started.json.status).toBe('in_progress');

    // register a plain employee
    await req('POST', '/auth/register', { tenantId: demo, username: 'inv_emp', password: 'Pass123456' });
    const emp = await req('POST', '/auth/login', { username: 'inv_emp', password: 'Pass123456' });
    const empToken = emp.json.accessToken;

    // employee cannot create a cycle (403)
    const forbidden = await req('POST', '/inventory/cycles', { year: 2027, scope: { all: true } }, empToken);
    expect(forbidden.status).toBe(403);

    const closed = await req('PATCH', `/inventory/cycles/${cycleId}/close`, {}, adminToken);
    expect(closed.json.status).toBe('closed');

    // closing twice → invalid transition (409)
    const again = await req('PATCH', `/inventory/cycles/${cycleId}/close`, {}, adminToken);
    expect(again.status).toBe(409);
  });
});

/**
 * E2E — Master Data endpoints over HTTP: RBAC + auth.
 * Reference: API Spec (DOC-10) · Security (RBAC)
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

describe('Master Data — E2E HTTP (RBAC, auth, duplicate)', () => {
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

  it('creates a location as admin; employee is forbidden (403)', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;

    const created = await req('POST', '/locations', { name: 'DataCenter' }, adminToken);
    expect(created.status).toBe(201);
    expect(created.json.path).toBe('datacenter');

    // employee
    await req('POST', '/auth/register', { tenantId: '00000000-0000-4000-8000-000000000001', username: 'md_emp', password: 'Pass123456' });
    const emp = await req('POST', '/auth/login', { username: 'md_emp', password: 'Pass123456' });
    const empToken = emp.json.accessToken;

    const forbidden = await req('POST', '/locations', { name: 'Hack' }, empToken);
    expect(forbidden.status).toBe(403);

    // duplicate → 409
    const dup = await req('POST', '/locations', { name: 'DataCenter' }, adminToken);
    expect(dup.status).toBe(409);

    // unauthenticated GET → 401
    const noAuth = await req('GET', '/locations');
    expect(noAuth.status).toBe(401);
  });

  it('admin manages asset statuses while an employee is forbidden', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;
    const created = await req('POST', '/statuses', { name: 'Awaiting inspection', color: '#2563eb' }, adminToken);
    expect(created.status).toBe(201);
    expect(created.json.color).toBe('#2563eb');

    const listed = await req('GET', '/statuses', undefined, adminToken);
    expect(listed.status).toBe(200);
    expect(listed.json.some((status: { id: string }) => status.id === created.json.id)).toBe(true);

    const updated = await req('PATCH', `/statuses/${created.json.id}`, { name: 'Inspection queued', color: '#7c3aed' }, adminToken);
    expect(updated.status).toBe(200);
    expect(updated.json.name).toBe('Inspection queued');

    const employee = await req('POST', '/auth/login', { username: 'md_emp', password: 'Pass123456' });
    const forbidden = await req('POST', '/statuses', { name: 'Unauthorized', color: '#ef4444' }, employee.json.accessToken);
    expect(forbidden.status).toBe(403);

    const invalidColor = await req('POST', '/statuses', { name: 'Invalid color', color: 'purple' }, adminToken);
    expect(invalidColor.status).toBe(400);
    expect(invalidColor.json.error.code).toBe('VALIDATION_ERROR');
  });
});

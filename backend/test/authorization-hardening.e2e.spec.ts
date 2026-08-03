/**
 * E2E — Authorization Hardening over HTTP (Phase 9.5).
 * Permission version staleness (Task 5) forces a refresh; permission guard denies.
 * Reference: ADR-009 · Security Architecture
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
import { bumpPermissionVersion } from '../src/bootstrap/permission-version';
import * as http from 'http';

describe('Authorization Hardening — E2E HTTP', () => {
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

  it('bumping permission_version invalidates an existing token (PERMISSIONS_STALE)', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const token = admin.json.accessToken;

    // admin token works before bump
    const ok = await req('GET', '/dashboard/assets', undefined, token);
    expect(ok.status).toBe(200);

    // bump the demo tenant permission version → token becomes stale
    await bumpPermissionVersion(db, demo);

    const stale = await req('GET', '/dashboard/assets', undefined, token);
    expect(stale.status).toBe(401);
    expect(stale.json.error.code).toBe('PERMISSIONS_STALE');

    // re-login → fresh token reflects new version → works
    const admin2 = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const ok2 = await req('GET', '/dashboard/assets', undefined, admin2.json.accessToken);
    expect(ok2.status).toBe(200);
  });

  it('a user without a permission gets 403 (permission-based denial)', async () => {
    // register a plain user, assign Employee role (asset.view only)
    await req('POST', '/auth/register', { tenantId: demo, username: 'ah_emp', password: 'Pass123456' });
    await db.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${demo}', u.id, r.id FROM users u, roles r
       WHERE u.username='ah_emp' AND r.name='Employee' AND r.tenant_id='${demo}'
       ON CONFLICT DO NOTHING`,
    );
    const emp = await req('POST', '/auth/login', { username: 'ah_emp', password: 'Pass123456' });
    const empToken = emp.json.accessToken;

    // Employee can view dashboard? No — Employee lacks dashboard.view → 403
    const denied = await req('GET', '/dashboard/assets', undefined, empToken);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('FORBIDDEN');
  });
});

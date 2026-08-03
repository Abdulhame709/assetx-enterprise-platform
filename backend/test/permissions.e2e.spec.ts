/**
 * E2E — Permission guard over HTTP: grant/revoke permission changes access.
 * Phase 9: @RequirePermission drives access in addition to @Roles.
 * Reference: Phase 9 permission matrix · Security Architecture
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

describe('Permission guard — E2E HTTP', () => {
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

  it('grant asset.create → 200; revoke asset.create → 403 (same role)', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;
    const cat = (await db.query(`SELECT id FROM asset_categories WHERE tenant_id='${demo}' LIMIT 1`)).rows[0].id;
    const loc = (await db.query(`SELECT id FROM locations WHERE tenant_id='${demo}' LIMIT 1`)).rows[0].id;
    const st = (await db.query(`SELECT id FROM statuses WHERE tenant_id='${demo}' LIMIT 1`)).rows[0].id;

    // user with 'Asset Manager' role (has asset.create via catalog)
    await req('POST', '/auth/register', { tenantId: demo, username: 'pm_mgr', password: 'Pass123456' });
    await db.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${demo}', u.id, r.id FROM users u, roles r
       WHERE u.username='pm_mgr' AND r.name='Asset Manager' AND r.tenant_id='${demo}'
       ON CONFLICT DO NOTHING`,
    );
    const mgr = await req('POST', '/auth/login', { username: 'pm_mgr', password: 'Pass123456' });
    const mgrToken = mgr.json.accessToken;

    // Asset Manager has asset.create → create succeeds (200/201)
    const created = await req('POST', '/assets', { name: 'Granted Asset', category_id: cat, location_id: loc, status_id: st }, mgrToken);
    expect(created.status).toBe(201);

    // Revoke asset.create from the Asset Manager role (delete role_permissions link)
    await db.query(
      `DELETE FROM role_permissions WHERE role_id IN (
         SELECT id FROM roles WHERE tenant_id='${demo}' AND name='Asset Manager'
       ) AND permission_id IN (
         SELECT id FROM permissions WHERE tenant_id='${demo}' AND module_name='asset.create'
       )`,
    );

    // Re-login so the new (revoked) permissions are embedded in the JWT
    const mgr2 = await req('POST', '/auth/login', { username: 'pm_mgr', password: 'Pass123456' });
    const mgrToken2 = mgr2.json.accessToken;

    // Now create → 403 (permission guard, even though role still allows it via @Roles)
    const forbidden = await req('POST', '/assets', { name: 'Revoked', category_id: cat, location_id: loc, status_id: st }, mgrToken2);
    expect(forbidden.status).toBe(403);
    expect(forbidden.json.error.code).toBe('FORBIDDEN');

    // view still allowed (asset.view retained) → 200
    const view = await req('GET', '/assets', undefined, mgrToken2);
    expect(view.status).toBe(200);
  });
});

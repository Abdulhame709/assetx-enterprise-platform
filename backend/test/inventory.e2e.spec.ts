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

  it('admin completes a location-aware cycle from asset creation through count, verification, and close', async () => {
    const admin = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    const adminToken = admin.json.accessToken;
    const db = app.get<DatabasePort>(DATABASE_PORT);
    await db.setTenant(demo);

    const category = (await db.query<{ id: string }>(
      'SELECT id FROM asset_categories WHERE tenant_id = $1 ORDER BY name LIMIT 1', [demo],
    )).rows[0];
    const location = (await db.query<{ id: string }>(
      'SELECT id FROM locations WHERE tenant_id = $1 ORDER BY full_path LIMIT 1', [demo],
    )).rows[0];
    const status = (await db.query<{ id: string }>(
      'SELECT id FROM statuses WHERE tenant_id = $1 ORDER BY name LIMIT 1', [demo],
    )).rows[0];

    expect(category?.id).toBeTruthy();
    expect(location?.id).toBeTruthy();
    expect(status?.id).toBeTruthy();

    const asset = await req('POST', '/assets', {
      name: 'API Inventory Test Laptop',
      category_id: category.id,
      location_id: location.id,
      status_id: status.id,
      quantity: 1,
      purchase_price: 4200,
      purchase_date: '2024-01-01',
      depreciation_rate: 20,
      useful_life: 4,
    }, adminToken);
    expect(asset.status).toBe(201);
    expect(asset.json.id).toBeTruthy();
    expect(asset.json.base_asset_code).toMatch(/^2026-\d{4}$/);
    expect(asset.json.full_asset_code).toMatch(/^2026-\d{4}@/);

    const depreciation = await req('GET', `/assets/${asset.json.id}/depreciation`, undefined, adminToken);
    expect(depreciation.status).toBe(200);
    expect(depreciation.json.asset_id).toBe(asset.json.id);
    expect(depreciation.json.bookValue).toBeGreaterThanOrEqual(0);
    expect(depreciation.json.bookValue).toBeLessThan(4200);
    expect(depreciation.json.ageYears).toBeGreaterThanOrEqual(2);

    const cycle = await req('POST', '/inventory/cycles', { year: 2034, scope: { all: true } }, adminToken);
    expect(cycle.status).toBe(201);
    expect(cycle.json.snapshotCount).toBeGreaterThanOrEqual(1);
    const cycleId = cycle.json.cycle.id as string;

    const started = await req('PATCH', `/inventory/cycles/${cycleId}/start`, {}, adminToken);
    expect(started.status).toBe(200);
    expect(started.json.status).toBe('in_progress');

    const mobileSnapshot = await req('GET', `/inventory/cycles/${cycleId}/mobile-snapshot`, undefined, adminToken);
    expect(mobileSnapshot.status).toBe(200);
    const mobileRecord = mobileSnapshot.json.records.find((record: { asset_id: string }) => record.asset_id === asset.json.id);
    expect(mobileRecord.expected_location_id).toBe(location.id);
    expect(mobileRecord.expected_location_path).toBeTruthy();

    const counted = await req('POST', `/inventory/cycles/${cycleId}/records`, {
      asset_id: asset.json.id,
      actual_location_id: location.id,
      actual_quantity: 1,
    }, adminToken);
    expect(counted.status).toBe(201);

    const results = await req('GET', `/inventory/cycles/${cycleId}/results`, undefined, adminToken);
    const record = results.json.find((item: { asset_id: string }) => item.asset_id === asset.json.id);
    expect(record.result).toBe('matched');

    const verified = await req('PATCH', `/inventory/records/${record.id}/verify`, { verified: true }, adminToken);
    expect(verified.status).toBe(200);
    expect(verified.json.is_verified).toBe(true);

    const closed = await req('PATCH', `/inventory/cycles/${cycleId}/close`, {}, adminToken);
    expect(closed.status).toBe(200);
    expect(closed.json.status).toBe('closed');

    const rejectedAfterClose = await req('POST', `/inventory/cycles/${cycleId}/records`, {
      asset_id: asset.json.id,
      actual_quantity: 1,
    }, adminToken);
    expect(rejectedAfterClose.status).toBe(409);
  });
});

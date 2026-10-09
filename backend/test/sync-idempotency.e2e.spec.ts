/**
 * E2E — offline inventory sync is idempotent and conflict-safe (action plan SEC-09).
 * A retried mutation_id is answered with its original result and never re-applied;
 * edits must state the server version they were based on; oversized batches are refused.
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
import { randomUUID } from 'crypto';
import * as http from 'http';

describe('Inventory offline sync — idempotency and conflicts (E2E HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let demo: string;
  let adminToken: string;
  let cycleId: string;
  let assets: Array<{ id: string }> = [];

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

    const login = await req('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    adminToken = login.json.accessToken;

    const dbPort = app.get<DatabasePort>(DATABASE_PORT);
    await dbPort.setTenant(demo);
    const category = (await dbPort.query<{ id: string }>('SELECT id FROM asset_categories WHERE tenant_id = $1 LIMIT 1', [demo])).rows[0];
    const location = (await dbPort.query<{ id: string }>('SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1', [demo])).rows[0];
    const status = (await dbPort.query<{ id: string }>('SELECT id FROM statuses WHERE tenant_id = $1 LIMIT 1', [demo])).rows[0];
    for (const name of ['Sync Test Asset A', 'Sync Test Asset B']) {
      const created = await req('POST', '/assets', {
        name, category_id: category.id, location_id: location.id, status_id: status.id, quantity: 1,
      }, adminToken);
      expect(created.status).toBe(201);
      assets.push({ id: created.json.id });
    }

    const cycle = await req('POST', '/inventory/cycles', { year: 2035, scope: { all: true } }, adminToken);
    expect(cycle.status).toBe(201);
    cycleId = cycle.json.cycle.id;
    expect((await req('PATCH', `/inventory/cycles/${cycleId}/start`, {}, adminToken)).status).toBe(200);
  }, 180000);

  afterAll(async () => { await app?.close(); });

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
      r.on('error', (e) => resolve({ status: 0, json: String(e) }));
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  async function snapshotRecord(assetId: string) {
    const snap = await req('GET', `/inventory/cycles/${cycleId}/mobile-snapshot`, undefined, adminToken);
    expect(snap.status).toBe(200);
    const record = snap.json.records.find((r: { asset_id: string }) => r.asset_id === assetId);
    expect(record).toBeTruthy();
    return record as { record_id: string; asset_id: string; updated_at: string; actual_quantity: number | null; notes: string | null };
  }

  function mutation(record: { record_id: string; asset_id: string; updated_at: string | null }, overrides: Record<string, unknown> = {}) {
    return {
      mutation_id: randomUUID(),
      record_id: record.record_id,
      asset_id: record.asset_id,
      mode: 'update',
      base_updated_at: record.updated_at,
      payload: { actual_quantity: 1, notes: 'counted offline' },
      ...overrides,
    };
  }

  const sync = (mutations: unknown[]) =>
    req('POST', `/inventory/cycles/${cycleId}/sync`, { mutations }, adminToken);

  it('applies a mutation, then answers a retry of the same mutation_id with the original result', async () => {
    const record = await snapshotRecord(assets[0].id);
    const m = mutation(record, { payload: { actual_quantity: 1, notes: 'first count' } });

    const first = await sync([m]);
    expect(first.status).toBe(201);
    expect(first.json.results[0]).toMatchObject({ mutation_id: m.mutation_id, status: 'synced' });
    expect(first.json.results[0].replayed).toBeUndefined();
    const appliedAt = first.json.results[0].updated_at;

    // The response was "lost": the phone sends the very same mutation again.
    const retry = await sync([m]);
    expect(retry.json.results[0]).toMatchObject({
      mutation_id: m.mutation_id, status: 'synced', replayed: true, updated_at: appliedAt,
    });

    // It was not applied twice: the record still carries the first edit's version.
    const after = await snapshotRecord(assets[0].id);
    expect(new Date(after.updated_at).toISOString()).toBe(appliedAt);
    expect(after.notes).toBe('first count');
  });

  it('a replay of an old mutation does not overwrite a newer edit', async () => {
    const record = await snapshotRecord(assets[1].id);
    const older = mutation(record, { payload: { actual_quantity: 1, notes: 'older edit' } });
    const olderResult = await sync([older]);
    const afterOlder = { ...record, updated_at: olderResult.json.results[0].updated_at };

    const newer = mutation(afterOlder, { payload: { actual_quantity: 1, notes: 'newer edit' } });
    expect((await sync([newer])).json.results[0].status).toBe('synced');

    const replay = await sync([older]);
    expect(replay.json.results[0]).toMatchObject({ status: 'synced', replayed: true });
    expect((await snapshotRecord(assets[1].id)).notes).toBe('newer edit');
  });

  it('refuses a mutation that does not state the version it was based on', async () => {
    const record = await snapshotRecord(assets[0].id);
    const missing = await sync([mutation(record, { base_updated_at: null })]);
    expect(missing.json.results[0]).toMatchObject({ status: 'error', code: 'BASE_VERSION_REQUIRED' });

    const invalid = await sync([mutation(record, { base_updated_at: 'not-a-date' })]);
    expect(invalid.json.results[0]).toMatchObject({ status: 'error', code: 'BASE_VERSION_INVALID' });
  });

  it('reports a conflict when the record changed after the phone downloaded it', async () => {
    const record = await snapshotRecord(assets[0].id);
    const stale = { ...record, updated_at: '2000-01-01T00:00:00.000Z' };
    const result = await sync([mutation(stale)]);
    expect(result.json.results[0]).toMatchObject({ status: 'conflict', code: 'SYNC_CONFLICT' });
  });

  it('rejects a mutation_id that is reused for a different record', async () => {
    const recordA = await snapshotRecord(assets[0].id);
    const recordB = await snapshotRecord(assets[1].id);
    const m = mutation(recordA, { payload: { actual_quantity: 1, notes: 'unique edit' } });
    expect((await sync([m])).json.results[0].status).toBe('synced');

    const reused = await sync([{ ...mutation(recordB), mutation_id: m.mutation_id }]);
    expect(reused.json.results[0]).toMatchObject({ status: 'error', code: 'MUTATION_ID_REUSED' });
  });

  it('rejects an invalid mutation_id', async () => {
    const record = await snapshotRecord(assets[0].id);
    const tooLong = await sync([mutation(record, { mutation_id: 'x'.repeat(129) })]);
    expect(tooLong.json.results[0]).toMatchObject({ status: 'error', code: 'MUTATION_ID_INVALID' });
    const empty = await sync([mutation(record, { mutation_id: '' })]);
    expect(empty.json.results[0]).toMatchObject({ status: 'error', code: 'MUTATION_ID_INVALID' });
  });

  it('applies several edits of one record in queue order within one batch', async () => {
    const record = await snapshotRecord(assets[1].id);
    const first = mutation(record, { payload: { actual_quantity: 1, notes: 'step 1' } });
    // The second edit can only be based on the version produced by the first one,
    // so it can only succeed if the server applies them sequentially. We cannot
    // know that version up front, so a stale second base must be reported as a
    // conflict rather than silently overwriting.
    const second = mutation(record, { payload: { actual_quantity: 1, notes: 'step 2' } });
    const result = await sync([first, second]);
    expect(result.json.results.map((r: { status: string }) => r.status)).toEqual(['synced', 'conflict']);
    expect((await snapshotRecord(assets[1].id)).notes).toBe('step 1');
  });

  it('refuses a batch above 100 mutations instead of dropping the extra ones', async () => {
    const record = await snapshotRecord(assets[0].id);
    const batch = Array.from({ length: 101 }, () => mutation(record));
    const res = await sync(batch);
    expect(res.status).toBe(413);
  });

  it('requires the inventory.execute permission', async () => {
    await req('POST', '/users/admin/users', { username: 'sync_emp', password: 'Pass123456' }, adminToken);
    const emp = await req('POST', '/auth/login', { username: 'sync_emp', password: 'Pass123456' });
    const res = await req('POST', `/inventory/cycles/${cycleId}/sync`, { mutations: [] }, emp.json.accessToken);
    expect(res.status).toBe(403);
  });
});

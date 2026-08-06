/**
 * E2E test — RC1 stabilization D2: UUID validation on API params and filters.
 * Malformed UUIDs must return HTTP 400 VALIDATION_ERROR (INVALID_UUID) instead
 * of a raw 500 from the database.
 * Reference: API Spec (DOC-10) §16 error format · error-codes.ts
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

describe('RC1 D2 — UUID validation (HTTP 400, not 500)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let token: string;

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
    const server = app.getHttpServer();
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const login = await request('POST', '/auth/login', { username: 'admin', password: 'AdminPass123' });
    token = login.json.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function request(method: string, path: string, body?: unknown, authToken?: string) {
    return new Promise<{ status: number; json: any }>((resolve) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let json: any = null;
          try { json = JSON.parse(d); } catch { json = d; }
          resolve({ status: res.statusCode ?? 0, json });
        });
      });
      if (data) req.write(data);
      req.end();
    });
  }

  // NOTE: empty-string filters are treated as "absent" (optional) — not malformed.
  const INVALID = ['not-a-uuid', 'undefined', 'zzz'];

  it.each(INVALID)('asset path param %p → 400 VALIDATION_ERROR', async (id) => {
    const res = await request('GET', `/assets/${id}`, undefined, token);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION_ERROR');
    expect(res.json.error.message).toBe('INVALID_UUID');
  });

  it.each(INVALID)('asset query filter %p → 400 VALIDATION_ERROR', async (id) => {
    for (const key of ['category_id', 'location_id', 'employee_id', 'status_id']) {
      const res = await request('GET', `/assets?${key}=${encodeURIComponent(id)}`, undefined, token);
      expect(res.status).toBe(400);
      expect(res.json.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it.each([
    'GET /lifecycle/assets/not-a-uuid/state',
    'GET /lifecycle/assets/not-a-uuid/transitions',
    'GET /movements/not-a-uuid',
    'PATCH /movements/not-a-uuid/approve',
    'PATCH /movements/not-a-uuid/reject',
    'GET /inventory/cycles/not-a-uuid',
    'PATCH /inventory/cycles/not-a-uuid/start',
    'GET /inventory/cycles/not-a-uuid/summary',
    'GET /inventory/cycles/not-a-uuid/records',
    'GET /audit/assets/not-a-uuid',
    'GET /categories/not-a-uuid',
    'GET /locations/not-a-uuid',
    'GET /employees/not-a-uuid',
    'GET /models/not-a-uuid',
    'PATCH /notifications/not-a-uuid/read',
    'GET /search/saved/not-a-uuid/execute',
    'GET /audit/events?user=not-a-uuid',
    'GET /search/assets?location_id=not-a-uuid',
    'GET /search/movements?asset_id=not-a-uuid',
    'GET /search/audit?user_id=not-a-uuid',
  ])('%s → 400 VALIDATION_ERROR', async (path) => {
    const [method, rest] = path.split(' ');
    const res = await request(method, rest, undefined, token);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION_ERROR');
    expect(res.json.error.message).toBe('INVALID_UUID');
  });

  it('POST /assets with malformed uuid body field → 400 VALIDATION_ERROR', async () => {
    const res = await request('POST', '/assets', {
      name: 'Bad UUID Asset', category_id: 'not-a-uuid', location_id: 'not-a-uuid', status_id: 'not-a-uuid',
    }, token);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST movement with malformed uuid body field → 400 VALIDATION_ERROR', async () => {
    const res = await request('POST', '/assets/not-a-uuid/movements', {
      asset_id: 'not-a-uuid', movement_type: 'transfer',
    }, token);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION_ERROR');
  });

  it('valid requests are unaffected (still 2xx)', async () => {
    const res = await request('GET', '/assets?limit=5', undefined, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.items)).toBe(true);
  });
});

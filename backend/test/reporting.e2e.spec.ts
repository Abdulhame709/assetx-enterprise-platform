/**
 * E2E — Reporting/Dashboard endpoints over HTTP: RBAC + auth.
 * Reference: API Spec (DOC-10) §11 · Security (RBAC)
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

describe('Reporting — E2E HTTP (RBAC, auth)', () => {
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

  function req(method: string, path: string, token?: string) {
    return new Promise<{ status: number; json: any }>((resolve) => {
      const r = http.request(`${baseUrl}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => {
          let j: any = null; try { j = JSON.parse(d); } catch { j = d; }
          resolve({ status: res.statusCode ?? 0, json: j });
        });
      });
      r.end();
    });
  }

  it('admin can read dashboards; unauth is 401', async () => {
    const admin = await req('POST', '/auth/login', 'x').then(() =>
      new Promise<any>((resolve) => {
        const r = http.request(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
          let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(JSON.parse(d)));
        });
        r.write(JSON.stringify({ username: 'admin', password: 'AdminPass123' }));
        r.end();
      }),
    );
    const token = admin.accessToken;

    const assets = await req('GET', '/dashboard/assets', token);
    expect(assets.status).toBe(200);
    expect(typeof assets.json.total_assets).toBe('number');

    const movements = await req('GET', '/dashboard/movements', token);
    expect(movements.status).toBe(200);

    const inventory = await req('GET', '/dashboard/inventory', token);
    expect(inventory.status).toBe(200);

    const aging = await req('GET', '/dashboard/aging', token);
    expect(aging.status).toBe(200);

    // unauthenticated → 401
    const noAuth = await req('GET', '/dashboard/assets');
    expect(noAuth.status).toBe(401);
  });
});

/**
 * Test harness — boots a real PGlite (PostgreSQL) instance, applies the verified
 * migration + seed, and returns an in-memory database with helper factories.
 * Reference: db/migrations/001_init.sql · db/seed/001_seed.sql
 */
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from '../../src/infrastructure/database/pglite.database';
import { BcryptHasher } from '../../src/infrastructure/auth/bcrypt.hasher';
import { JwtTokenManager } from '../../src/infrastructure/auth/jwt.token-manager';
import { UserRepository } from '../../src/infrastructure/repositories/user.repository';
import { AuthService } from '../../src/application/auth.service';
import { UsersService } from '../../src/application/users.service';
import { AssetRepository } from '../../src/infrastructure/repositories/asset.repository';
import { AssetService } from '../../src/application/asset.service';
import * as fs from 'fs';
import * as path from 'path';

export interface Harness {
  db: PGliteDatabase;
  repo: UserRepository;
  auth: AuthService;
  users: UsersService;
  tokens: JwtTokenManager;
  hasher: BcryptHasher;
  assetRepo: AssetRepository;
  assets: AssetService;
  tenantA: string;
  tenantB: string;
  /** Reference data for tenant A: statuses/locations/categories used by asset tests. */
  refA: { status: string; location: string; category: string };
  refB: { status: string; location: string; category: string };
}

const ACCESS = 'test-access-secret';
const REFRESH = 'test-refresh-secret';

export async function createHarness(): Promise<Harness> {
  const pg = new PGlite();
  const db = new PGliteDatabase(pg);

  const migration = fs.readFileSync(
    path.resolve(__dirname, '../../../db/migrations/001_init.sql'),
    'utf8',
  );
  await db.exec(migration);

  // Seed reference data for two tenants
  await db.exec(
    `INSERT INTO tenants (tenant_code, name, status) VALUES ('tenant_a','Tenant A','active'), ('tenant_b','Tenant B','active');`,
  );
  const { rows: tenants } = await db.query<{ id: string; tenant_code: string }>(
    `SELECT id, tenant_code FROM tenants;`,
  );
  const tenantA = tenants.find((t) => t.tenant_code === 'tenant_a')!.id;
  const tenantB = tenants.find((t) => t.tenant_code === 'tenant_b')!.id;

  // Seed roles for each tenant
  for (const tid of [tenantA, tenantB]) {
    await db.setTenant(tid);
    await db.exec(
      `INSERT INTO roles (tenant_id, name, role_type) VALUES
         ('${tid}','Administrator','admin'),
         ('${tid}','Asset Manager','manager'),
         ('${tid}','Employee','employee');`,
    );
    // Reference data: a status, a location, a category per tenant
    await db.exec(`
      INSERT INTO statuses (tenant_id, name, color) VALUES ('${tid}','Good','#27ae60');
      INSERT INTO locations (tenant_id, name, path, full_path, level_number)
        VALUES ('${tid}','HQ','hq','HQ',0);
      INSERT INTO asset_categories (tenant_id, name) VALUES ('${tid}','IT');
    `);
  }

  async function refFor(tid: string) {
    await db.setTenant(tid);
    const status = (await db.query<{ id: string }>(`SELECT id FROM statuses WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const location = (await db.query<{ id: string }>(`SELECT id FROM locations WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const category = (await db.query<{ id: string }>(`SELECT id FROM asset_categories WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    return { status, location, category };
  }
  const refA = await refFor(tenantA);
  const refB = await refFor(tenantB);

  // Create a non-owner 'authenticated' role and act as it for all queries.
  // This mirrors the Supabase production model where the API connects as a
  // non-owner role, so Row-Level Security actually applies (owner bypasses RLS).
  await db.exec(`CREATE ROLE authenticated NOLOGIN;`);
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      tenants, organizations, employees, users, roles, permissions, role_permissions,
      user_roles, user_permissions, asset_categories, asset_models, statuses,
      locations, assets, asset_movements, maintenance_orders, inventory_cycles,
      inventory_team, inventory_records, audit_events, notification_templates,
      notifications, settings TO authenticated;
    GRANT USAGE ON SCHEMA public TO authenticated;
  `);
  await db.exec(`SET ROLE authenticated;`);

  const hasher = new BcryptHasher();
  const tokens = new JwtTokenManager(ACCESS, REFRESH);
  const repo = new UserRepository(db);
  const auth = new AuthService(db, repo, hasher, tokens);
  const users = new UsersService(repo);
  const assetRepo = new AssetRepository(db);
  const assets = new AssetService(assetRepo, db);

  return { db, repo, auth, users, tokens, hasher, assetRepo, assets, tenantA, tenantB, refA, refB };
}

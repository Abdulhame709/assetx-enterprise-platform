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
import * as fs from 'fs';
import * as path from 'path';

export interface Harness {
  db: PGliteDatabase;
  repo: UserRepository;
  auth: AuthService;
  users: UsersService;
  tokens: JwtTokenManager;
  hasher: BcryptHasher;
  tenantA: string;
  tenantB: string;
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
  }

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

  return { db, repo, auth, users, tokens, hasher, tenantA, tenantB };
}

/**
 * Database bootstrap for local/dev runtime.
 * Applies the verified migration + a demo tenant to a given PGlite instance so
 * the running backend is connected to a real, migrated PostgreSQL schema.
 * Production (Supabase) applies migrations via Prisma/psql; this is the local path.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from '../infrastructure/database/pglite.database';
import * as fs from 'fs';
import * as path from 'path';

/** Apply migration + demo tenant to the provided PGlite instance. */
export async function initLocalDatabase(pg: PGlite): Promise<void> {
  const db = new PGliteDatabase(pg);
  const migration = fs.readFileSync(
    path.resolve(__dirname, '../../../db/migrations/001_init.sql'),
    'utf8',
  );
  await db.exec(migration);

  // Create a demo tenant (deterministic UUID for local tooling) so auth endpoints
  // have a known tenant to bind to.
  const DEMO_TENANT_ID = '00000000-0000-4000-8000-000000000001';
  await db.exec(
    `INSERT INTO tenants (id, tenant_code, name, status) VALUES
       ('${DEMO_TENANT_ID}', 'demo', 'AssetX Demo', 'active')
     ON CONFLICT (tenant_code) DO NOTHING;`,
  );
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM tenants WHERE tenant_code = 'demo' LIMIT 1`,
  );
  const tenantId = rows[0].id;
  // Create the non-owner 'authenticated' role (production-like RLS semantics).
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
  // Seed roles for the demo tenant
  await db.setTenant(tenantId);
  await db.exec(
    `INSERT INTO roles (tenant_id, name, role_type) VALUES
       ('${tenantId}','Administrator','admin'),
       ('${tenantId}','Asset Manager','manager'),
       ('${tenantId}','Employee','employee')
     ON CONFLICT (tenant_id, name) DO NOTHING;`,
  );
  await db.exec(`SET ROLE postgres;`); // reset to owner for app-level setup
}

/** Convenience: create a fresh initialized PGlite (used by tooling/tests). */
export async function createInitializedDatabase(): Promise<PGliteDatabase> {
  const pg = new PGlite();
  await initLocalDatabase(pg);
  return new PGliteDatabase(pg);
}

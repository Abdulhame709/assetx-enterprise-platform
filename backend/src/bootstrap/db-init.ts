/**
 * Database bootstrap for local/dev runtime.
 * Applies the verified migration + a demo tenant to a given PGlite instance so
 * the running backend is connected to a real, migrated PostgreSQL schema.
 * Production (Supabase) applies migrations via Prisma/psql; this is the local path.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from '../infrastructure/database/pglite.database';
import { seedPermissions } from './permission-seed';
import { seedNotificationTemplates } from './notification-seed';
import * as fs from 'fs';
import * as path from 'path';

/** Apply migration + demo tenant to the provided PGlite instance. */
export async function initLocalDatabase(pg: PGlite): Promise<void> {
  const db = new PGliteDatabase(pg);
  const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_init.sql'), 'utf8');
  await db.exec(migration001);
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_movement_lifecycle.sql'), 'utf8');
  await db.exec(migration002);
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_saved_searches.sql'), 'utf8');
  await db.exec(migration003);

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
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;
  `);
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      tenants, organizations, employees, users, roles, permissions, role_permissions,
      user_roles, user_permissions, asset_categories, asset_models, statuses,
      locations, assets, asset_movements, maintenance_orders, inventory_cycles,
      inventory_team, inventory_records, audit_events, notification_templates,
      notifications, settings TO authenticated;
    GRANT USAGE ON SCHEMA public TO authenticated;
  `);
  // Seed roles + reference data for the demo tenant
  await db.setTenant(tenantId);
  await db.exec(
    `INSERT INTO roles (tenant_id, name, role_type) VALUES
       ('${tenantId}','Administrator','admin'),
       ('${tenantId}','Asset Manager','manager'),
       ('${tenantId}','Employee','employee')
     ON CONFLICT (tenant_id, name) DO NOTHING;
     INSERT INTO statuses (tenant_id, name, color) VALUES ('${tenantId}','Good','#27ae60');
     INSERT INTO asset_categories (tenant_id, name) VALUES ('${tenantId}','IT');
     INSERT INTO locations (tenant_id, name, path, full_path, level_number)
       VALUES ('${tenantId}','HQ','hq','HQ',0);`,
  );

  // Bootstrap Administrator user (hashed with bcrypt cost 12) for the demo tenant.
  const adminHash = await hashForLocalDev('AdminPass123');
  await db.exec(
    `INSERT INTO users (tenant_id, username, email, password_hash, is_active)
       VALUES ('${tenantId}','admin','admin@assetx.io','${adminHash}',true)
     ON CONFLICT (username) DO NOTHING;
     INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${tenantId}', u.id, r.id FROM users u, roles r
       WHERE u.username='admin' AND r.name='Administrator' AND r.tenant_id='${tenantId}'
     ON CONFLICT DO NOTHING;`,
  );

  // Seed the permission catalog (flat keys → roles) for the demo tenant.
  await seedPermissions(db, tenantId);
  // Seed notification templates for the demo tenant.
  await seedNotificationTemplates(db, tenantId);

  await db.exec(`SET ROLE postgres;`); // reset to owner for app-level setup
}

/** Local dev-only: bcrypt hash for the bootstrap admin. (bcryptjs, cost 12) */
function hashForLocalDev(plain: string): Promise<string> {
  const bcrypt = require('bcryptjs');
  return bcrypt.hash(plain, 12);
}

/** Convenience: create a fresh initialized PGlite (used by tooling/tests). */
export async function createInitializedDatabase(): Promise<PGliteDatabase> {
  const pg = new PGlite();
  await initLocalDatabase(pg);
  return new PGliteDatabase(pg);
}

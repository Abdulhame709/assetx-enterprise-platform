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
import { LocationRepository } from '../../src/infrastructure/repositories/location.repository';
import { LocationService } from '../../src/application/location.service';
import { CategoryRepository } from '../../src/infrastructure/repositories/category.repository';
import { CategoryService } from '../../src/application/category.service';
import { ModelRepository } from '../../src/infrastructure/repositories/model.repository';
import { ModelService } from '../../src/application/model.service';
import { EmployeeRepository } from '../../src/infrastructure/repositories/employee.repository';
import { EmployeeService } from '../../src/application/employee.service';
import { CycleRepository } from '../../src/infrastructure/repositories/cycle.repository';
import { RecordRepository } from '../../src/infrastructure/repositories/record.repository';
import { ResultRepository } from '../../src/infrastructure/repositories/result.repository';
import { CycleService } from '../../src/application/cycle.service';
import { RecordService } from '../../src/application/record.service';
import { InventoryResultService } from '../../src/application/inventory-result.service';
import { MovementRepository } from '../../src/infrastructure/repositories/movement.repository';
import { MovementService } from '../../src/application/movement.service';
import { ReportingRepository } from '../../src/infrastructure/repositories/reporting.repository';
import { ReportingService } from '../../src/application/reporting.service';
import { seedPermissions } from '../../src/bootstrap/permission-seed';
import { AuditRepository } from '../../src/infrastructure/repositories/audit.repository';
import { AuditService } from '../../src/application/audit.service';
import { ComplianceService } from '../../src/application/compliance.service';
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
  locations: LocationService;
  categories: CategoryService;
  models: ModelService;
  employees: EmployeeService;
  cycles: CycleService;
  records: RecordService;
  inventoryResult: InventoryResultService;
  movements: MovementService;
  reporting: ReportingService;
  audit: AuditService;
  compliance: ComplianceService;
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

  const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_init.sql'), 'utf8');
  await db.exec(migration001);
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_movement_lifecycle.sql'), 'utf8');
  await db.exec(migration002);

  // Create a non-owner 'authenticated' role and grant table access.
  // This mirrors the Supabase production model where the API connects as a
  // non-owner role, so Row-Level Security actually applies (owner bypasses RLS).
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

  // Seed reference data for two tenants (as owner — RLS bypassed during setup)
  await db.exec(
    `INSERT INTO tenants (tenant_code, name, status) VALUES ('tenant_a','Tenant A','active'), ('tenant_b','Tenant B','active');`,
  );
  const { rows: tenants } = await db.query<{ id: string; tenant_code: string }>(
    `SELECT id, tenant_code FROM tenants;`,
  );
  const tenantA = tenants.find((t) => t.tenant_code === 'tenant_a')!.id;
  const tenantB = tenants.find((t) => t.tenant_code === 'tenant_b')!.id;

  // Seed roles + reference data for each tenant (owner context, RLS not applied)
  for (const tid of [tenantA, tenantB]) {
    await db.exec(
      `INSERT INTO roles (tenant_id, name, role_type) VALUES
         ('${tid}','Administrator','admin'),
         ('${tid}','Asset Manager','manager'),
         ('${tid}','Auditor','auditor'),
         ('${tid}','Department Manager','manager'),
         ('${tid}','Inventory Team','field'),
         ('${tid}','Maintenance','maintenance'),
         ('${tid}','Employee','employee');
       INSERT INTO statuses (tenant_id, name, color) VALUES ('${tid}','Good','#27ae60');
       INSERT INTO locations (tenant_id, name, path, full_path, level_number)
         VALUES ('${tid}','HQ','hq','HQ',0);
       INSERT INTO asset_categories (tenant_id, name) VALUES ('${tid}','IT');`,
    );
  }

  async function refFor(tid: string) {
    const status = (await db.query<{ id: string }>(`SELECT id FROM statuses WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const location = (await db.query<{ id: string }>(`SELECT id FROM locations WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const category = (await db.query<{ id: string }>(`SELECT id FROM asset_categories WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    return { status, location, category };
  }
  const refA = await refFor(tenantA);
  const refB = await refFor(tenantB);

  // Seed permission catalog (flat keys → roles) for both tenants.
  await seedPermissions(db, tenantA);
  await seedPermissions(db, tenantB);

  // Act as the authenticated role for all subsequent (app) queries.
  await db.exec(`SET ROLE authenticated;`);

  const hasher = new BcryptHasher();
  const tokens = new JwtTokenManager(ACCESS, REFRESH);
  const repo = new UserRepository(db);
  const audit = new AuditService(new AuditRepository(db), db);
  const auth = new AuthService(db, repo, hasher, tokens, audit);
  const users = new UsersService(repo);
  const assetRepo = new AssetRepository(db);
  const assets = new AssetService(assetRepo, db, audit);
  const locations = new LocationService(new LocationRepository(db), db);
  const categories = new CategoryService(new CategoryRepository(db), db);
  const models = new ModelService(new ModelRepository(db), db);
  const employees = new EmployeeService(new EmployeeRepository(db), db);
  const cycleRepo = new CycleRepository(db);
  const recordRepo = new RecordRepository(db);
  const resultRepo = new ResultRepository(db);
  const cycles = new CycleService(cycleRepo, recordRepo, db, audit);
  const records = new RecordService(cycleRepo, recordRepo, db);
  const inventoryResult = new InventoryResultService(cycleRepo, resultRepo, db);
  const movements = new MovementService(new MovementRepository(db), assetRepo, db, audit);
  const reporting = new ReportingService(new ReportingRepository(db), db);
  const compliance = new ComplianceService(db, audit);

  return { db, repo, auth, users, tokens, hasher, assetRepo, assets, locations, categories, models, employees, cycles, records, inventoryResult, movements, reporting, audit, compliance, tenantA, tenantB, refA, refB };
}

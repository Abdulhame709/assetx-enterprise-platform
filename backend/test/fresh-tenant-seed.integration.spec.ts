import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf8');
}

describe('fresh tenant seed after migration 012', () => {
  it('creates the standard location catalog before the default location', async () => {
    const pg = new PGlite();

    try {
      await pg.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN;
          END IF;
        END $$;
      `);

      const migrationsDir = path.resolve(__dirname, '../../db/migrations');
      const migrations = fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d+_.*\.sql$/.test(file))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const migration of migrations) {
        await pg.exec(fs.readFileSync(path.join(migrationsDir, migration), 'utf8'));
      }

      const tenantsBeforeSeed = await pg.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM tenants;',
      );
      expect(tenantsBeforeSeed.rows[0]?.count).toBe('0');

      const tenantResult = await pg.query<{ id: string }>(
        `
          INSERT INTO tenants (tenant_code, name, status)
          VALUES ('fresh_seed_test', 'Fresh Seed Test', 'active')
          RETURNING id;
        `,
      );
      const tenantId = tenantResult.rows[0]?.id;
      expect(tenantId).toMatch(/^[0-9a-f-]{36}$/i);

      await pg.query(`SELECT set_config('app.tenant_id', $1, false);`, [tenantId]);
      for (const seedFile of ['000_location_types.sql', '001_seed.sql', '002_permissions.sql']) {
        try {
          await pg.exec(readProjectFile(`db/seed/${seedFile}`));
        } catch (error) {
          throw new Error(`seed failed: ${seedFile}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const locationTypes = await pg.query<{ code: string }>(
        `
          SELECT code
          FROM location_types
          WHERE tenant_id = $1
          ORDER BY sort_order;
        `,
        [tenantId],
      );
      expect(locationTypes.rows.map((row) => row.code)).toEqual([
        'building',
        'room',
        'warehouse',
        'workshop',
        'outdoor',
      ]);

      const defaultLocation = await pg.query<{ location_type: string }>(
        `
          SELECT location_type
          FROM locations
          WHERE tenant_id = $1 AND name = 'Headquarters';
        `,
        [tenantId],
      );
      expect(defaultLocation.rows).toEqual([{ location_type: 'building' }]);

      const administratorLocationTypePermissions = await pg.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM role_permissions rp
          JOIN roles r ON r.id = rp.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE r.tenant_id = $1
            AND r.name = 'Administrator'
            AND p.module_name IN (
              'location_type.view', 'location_type.create', 'location_type.update',
              'location_type.delete', 'settings.view', 'settings.update'
            );
        `,
        [tenantId],
      );
      expect(administratorLocationTypePermissions.rows[0]?.count).toBe('6');

      await pg.exec(readProjectFile('db/seed/000_location_types.sql'));
      const typeCountAfterReplay = await pg.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM location_types WHERE tenant_id = $1;',
        [tenantId],
      );
      expect(typeCountAfterReplay.rows[0]?.count).toBe('5');
    } finally {
      await pg.close();
    }
  });
});

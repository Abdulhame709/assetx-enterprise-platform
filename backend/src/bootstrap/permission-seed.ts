/**
 * Permission catalog seed — defines the flat permission keys per role.
 * Represented in the existing `permissions` table (module_name = permission key,
 * can_view = active marker) + `role_permissions` links.
 * Reference: Phase 9 permission catalog · Security Architecture (DOC-13) · AAB §13.5
 * No new tables.
 */
import { DatabasePort } from '../core/ports/database.port';

/** Flat permission keys per role. */
export const PERMISSION_CATALOG: Record<string, string[]> = {
  Administrator: [
    'asset.view', 'asset.create', 'asset.update', 'asset.delete', 'asset.transfer',
    'movement.view', 'movement.create', 'movement.approve', 'movement.reject',
    'inventory.create', 'inventory.execute', 'inventory.verify', 'inventory.close',
    'dashboard.view', 'report.export', 'audit.export',
  ],
  'Asset Manager': [
    'asset.view', 'asset.create', 'asset.update', 'asset.delete', 'asset.transfer',
    'movement.view', 'movement.create', 'movement.approve', 'movement.reject',
    'inventory.create', 'inventory.execute', 'inventory.close', 'dashboard.view',
  ],
  Auditor: [
    'asset.view', 'movement.view', 'inventory.verify',
    'dashboard.view', 'report.export', 'audit.export',
  ],
  'Department Manager': ['asset.view', 'movement.view', 'dashboard.view'],
  'Inventory Team': ['inventory.execute', 'asset.view'],
  Maintenance: ['asset.view', 'movement.view'],
  Employee: ['asset.view'],
};

/** Idempotently seed permission rows + role_permissions for a tenant. */
export async function seedPermissions(db: DatabasePort, tenantId: string): Promise<void> {
  // Insert each permission key once per tenant (module_name = key, can_view = active)
  for (const keys of Object.values(PERMISSION_CATALOG)) {
    for (const key of keys) {
      await db.query(
        `INSERT INTO permissions (tenant_id, module_name, can_view, is_active)
         SELECT $1, $2, true, true
         WHERE NOT EXISTS (
           SELECT 1 FROM permissions WHERE tenant_id = $1 AND module_name = $2
         )`,
        [tenantId, key],
      );
    }
  }

  // Map each role to its permission rows
  for (const [roleName, keys] of Object.entries(PERMISSION_CATALOG)) {
    // role must exist (seeded before this)
    const role = await db.query<{ id: string }>(
      `SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
      [tenantId, roleName],
    );
    if (!role.rows[0]) continue;
    const roleId = role.rows[0].id;
    for (const key of keys) {
      await db.query(
        `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
         SELECT $1, $2, p.id FROM permissions p
         WHERE p.tenant_id = $1 AND p.module_name = $3
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [tenantId, roleId, key],
      );
    }
  }
}

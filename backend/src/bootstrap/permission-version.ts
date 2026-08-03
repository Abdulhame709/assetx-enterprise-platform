/**
 * Permission version helper — tracks the current permission version per tenant.
 * Stored in the existing `settings` table (key-value) as setting_key='permission_version'.
 * JWT carries the version at issue time; if it drifts from the DB version, the
 * request is rejected and a refresh is forced (Phase 9.5 — Task 5).
 * No new table, no schema change.
 */
import { DatabasePort } from '../core/ports/database.port';

const KEY = 'permission_version';

export async function getPermissionVersion(db: DatabasePort, tenantId: string): Promise<number> {
  const { rows } = await db.query<{ setting_value: string }>(
    `SELECT setting_value FROM settings WHERE tenant_id = $1 AND setting_key = $2 LIMIT 1`,
    [tenantId, KEY],
  );
  const v = Number(rows[0]?.setting_value ?? 0);
  return Number.isFinite(v) ? v : 0;
}

/** Bump the permission version — call whenever a user's permissions change. */
export async function bumpPermissionVersion(db: DatabasePort, tenantId: string): Promise<void> {
  const current = await getPermissionVersion(db, tenantId);
  await db.query(
    `INSERT INTO settings (tenant_id, setting_key, setting_value)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [tenantId, KEY, String(current + 1)],
  );
}

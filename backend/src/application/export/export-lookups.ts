/**
 * Export lookups — resolves foreign-key ids to human-readable names so exported
 * reports show "Main Office / Floor 2" instead of a raw UUID. Read-only; used
 * only by the export providers (presentation of data, no business logic).
 */
import { DatabasePort } from '../../core/ports/database.port';

export type NameMap = Map<string, string>;

export interface ExportNameMaps {
  categories: NameMap;
  statuses: NameMap;
  locations: NameMap;
  employees: NameMap;
  users: NameMap;
}

/** Arabic display names for the built-in status names (export presentation only). */
export const STATUS_AR: Record<string, string> = {
  'New': 'جديد',
  'Good': 'جيد',
  'Used': 'مستخدم',
  'Needs Maintenance': 'يحتاج صيانة',
  'Damaged': 'تالف',
};

async function load(db: DatabasePort, sql: string, tenantId: string): Promise<NameMap> {
  const { rows } = await db.query<{ id: string; label: string | null }>(sql, [tenantId]);
  const map: NameMap = new Map();
  for (const r of rows) if (r.label) map.set(r.id, r.label);
  return map;
}

export async function loadNameMaps(db: DatabasePort, tenantId: string): Promise<ExportNameMaps> {
  await db.setTenant(tenantId);
  const [categories, statuses, locations, employees, users] = await Promise.all([
    load(db, `SELECT id, name AS label FROM asset_categories WHERE tenant_id = $1`, tenantId),
    load(db, `SELECT id, name AS label FROM statuses WHERE tenant_id = $1`, tenantId),
    load(db, `SELECT id, COALESCE(NULLIF(full_path, ''), name) AS label FROM locations WHERE tenant_id = $1`, tenantId),
    load(db, `SELECT id, name AS label FROM employees WHERE tenant_id = $1`, tenantId),
    load(db, `SELECT id, username AS label FROM users WHERE tenant_id = $1`, tenantId),
  ]);
  return { categories, statuses, locations, employees, users };
}

/** Name for an id, or '' when the id is empty / unknown (never the raw UUID). */
export function nameOf(map: NameMap, id: unknown): string {
  return typeof id === 'string' ? map.get(id) ?? '' : '';
}

export function statusName(map: NameMap, id: unknown): string {
  const n = nameOf(map, id);
  return STATUS_AR[n] ?? n;
}

/** Date/timestamp to ISO text (date only for pure dates). Null stays ''. */
export function isoDate(value: unknown, withTime = false): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const iso = d.toISOString();
  return withTime ? iso.replace('T', ' ').slice(0, 19) : iso.slice(0, 10);
}

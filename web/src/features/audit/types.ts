/**
 * Audit feature types (Slice 4) — strict mirror of the live backend contract:
 *   GET /audit/events    → { items: AuditEventRow[], total }
 *   GET /audit/security  → { items: AuditEventRow[], total }   (LAST-500 window, security actions)
 *   GET /search/audit    → { items, total, page, limit, hasMore }
 *   GET /exports/audit?format=csv → file stream
 * No invented fields: anything the API does not send renders as an honest '—'.
 */

export interface AuditEventRow {
  id: string;
  user_id: string | null;
  action_type: string;
  table_name: string | null;
  record_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  geo: string | null;
  created_at: string;
}

export interface AuditQuery {
  /** action_type filter (backend catalog key, e.g. AUTH_LOGIN_SUCCESS) */
  action?: string | null;
  /** entity/table filter (backend `table_name`, e.g. auth/asset/permission) */
  entity?: string | null;
  user?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  page: number;
  limit: number;
}

export interface PagedAudit {
  items: AuditEventRow[];
  total: number;
}

export type AuditTab = 'all' | 'security';

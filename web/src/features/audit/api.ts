/**
 * Audit Experience API layer (Slice 4).
 * Real contracts only — the backend audit APIs are mature (admin/auditor scope):
 *   /audit/events · /audit/security · /exports/audit
 * No mock mode: this feature is real-only, like the rest of the app (AUTH_MODE=real).
 */
import { http, API_BASE_URL } from '@/lib/api/client';
import { AuditEventRow, AuditQuery, PagedAudit } from './types';

function asStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function normalizeList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

function toNumber(v: unknown, dft = 0): number {
  const n = Number(v);
  return Number.isNaN(n) ? dft : n;
}

export function mapAuditRow(r: Record<string, unknown>): AuditEventRow {
  const details = r.details && typeof r.details === 'object' && !Array.isArray(r.details)
    ? (r.details as Record<string, unknown>)
    : null;
  return {
    id: String(r.id ?? ''),
    user_id: asStr(r.user_id),
    action_type: String(r.action_type ?? ''),
    table_name: asStr(r.table_name),
    record_id: asStr(r.record_id),
    details,
    ip_address: asStr(r.ip_address),
    user_agent: asStr(r.user_agent),
    device_fingerprint: asStr(r.device_fingerprint),
    geo: asStr(r.geo),
    created_at: String(r.created_at ?? ''),
  };
}

export function mapPagedAudit(raw: unknown): PagedAudit {
  const items = normalizeList(raw).map(mapAuditRow);
  const total = raw && typeof raw === 'object' ? toNumber((raw as Record<string, unknown>).total, items.length) : items.length;
  return { items, total };
}

function buildParams(query: AuditQuery): string {
  const params = new URLSearchParams();
  if (query.action) params.set('action', query.action);
  if (query.entity) params.set('entity', query.entity);
  if (query.user) params.set('user', query.user);
  if (query.date_from) params.set('date_from', query.date_from);
  if (query.date_to) params.set('date_to', query.date_to);
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  return params.toString();
}

/** Paged audit events — GET /audit/events (audit.view). */
export async function getAuditEvents(query: AuditQuery): Promise<PagedAudit> {
  const raw = await http.get<unknown>(`/audit/events?${buildParams(query)}`);
  return mapPagedAudit(raw);
}

/** Security events (auth/permission stream, last-500 window) — GET /audit/security. */
export async function getSecurityEvents(query: AuditQuery): Promise<PagedAudit> {
  const raw = await http.get<unknown>(`/audit/security?${buildParams(query)}`);
  return mapPagedAudit(raw);
}

/** Download audit CSV — GET /exports/audit?format=csv (export.audit). */
export async function downloadAuditExport(): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_BASE_URL}/exports/audit?format=csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? 'audit-export.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

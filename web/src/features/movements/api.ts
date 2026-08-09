/**
 * Movements feature API — real contract with the NestJS movement module.
 * Reference: backend MovementController · MovementService · ADR-007
 * State machine (authoritative, backend-owned):
 *   create (POST /assets/:id/movements · PATCH dispose/retire) → pending (no asset change)
 *   pending --approve--> approved  (effect applied to the asset, BR-MOV-002)
 *   pending --reject-->  rejected  (no asset change)
 *   approved/rejected --any--> 409 MOVEMENT_NOT_PENDING
 * Special immediate path (AssetService.transfer · POST /assets/:id/transfer):
 *   asset mutation happens at once; the movement record keeps status 'pending'
 *   (DB default) and can later be approved (idempotent re-apply) or rejected
 *   (no-op on the asset). The UI never re-interprets this — it displays the
 *   stored status exactly as the backend owns it.
 */
import { http, API_BASE_URL } from '@/lib/api/client';
import { getEmployees, getStatuses, ReferenceEmployee, ReferenceStatus } from '@/features/reference/api';
import { getLocations } from '@/features/locations/api';

// ---------------------------------------------------------------------------
// Types (mirror backend entities; names resolved at mapper level, never in pages)
// ---------------------------------------------------------------------------

export type MovementType =
  | 'transfer'
  | 'assignment'
  | 'return'
  | 'maintenance_return'
  | 'disposal'
  | 'retirement';

export type MovementStatus = 'pending' | 'approved' | 'rejected';

export const MOVEMENT_TYPES: MovementType[] = [
  'transfer', 'assignment', 'return', 'maintenance_return', 'disposal', 'retirement',
];

export interface MovementRow {
  id: string;
  asset_id: string;
  movement_type: MovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_employee_id: string | null;
  to_employee_id: string | null;
  from_status_id: string | null;
  to_status_id: string | null;
  reason: string | null;
  reference_number: string | null;
  quantity: number | null;
  notes: string | null;
  performed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: MovementStatus;
  created_at: string;
  // resolved display fields (mapper enrichment; presentation only)
  _assetName?: string;
  _assetCode?: string;
  _fromLocation?: string | null;
  _toLocation?: string | null;
  _fromEmployee?: string | null;
  _toEmployee?: string | null;
  _fromStatus?: string | null;
  _toStatus?: string | null;
}

export interface MovementLookups {
  assets: Map<string, { name: string; code: string }>;
  locations: Map<string, string>;        // id → full_path
  employees: Map<string, ReferenceEmployee>;
  statuses: Map<string, ReferenceStatus>;
}

// ---------------------------------------------------------------------------
// Filter + paged result (GET /search/movements contract)
// ---------------------------------------------------------------------------

export type MovementStatusFilter = 'all' | MovementStatus;

export interface MovementFilter {
  status: MovementStatusFilter;
  movement_type: 'all' | MovementType;
  asset_id: string | null;
  created_at_from: string | null;   // ISO date (backend: created_at >=)
  created_at_to: string | null;     // ISO date (backend: created_at <=)
  page: number;
  limit: number;
}

export const DEFAULT_FILTER: MovementFilter = {
  status: 'pending',
  movement_type: 'all',
  asset_id: null,
  created_at_from: null,
  created_at_to: null,
  page: 1,
  limit: 20,
};

export interface PagedMovements {
  items: MovementRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function asArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const o = raw as { items?: unknown[]; data?: unknown[] } | null;
  const list = o?.items ?? o?.data ?? [];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

function toNumber(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function str(v: unknown): string | null {
  return v != null && v !== '' ? String(v) : null;
}

export function mapMovement(raw: unknown): MovementRow | null {
  const r = raw as Record<string, unknown>;
  if (!r?.id) return null;
  return {
    id: String(r.id),
    asset_id: String(r.asset_id ?? ''),
    movement_type: String(r.movement_type ?? 'transfer') as MovementType,
    from_location_id: str(r.from_location_id),
    to_location_id: str(r.to_location_id),
    from_employee_id: str(r.from_employee_id),
    to_employee_id: str(r.to_employee_id),
    from_status_id: str(r.from_status_id),
    to_status_id: str(r.to_status_id),
    reason: str(r.reason),
    reference_number: str(r.reference_number),
    quantity: r.quantity != null ? toNumber(r.quantity) : null,
    notes: str(r.notes),
    performed_by: str(r.performed_by),
    approved_by: str(r.approved_by),
    approved_at: str(r.approved_at),
    status: String(r.status ?? 'pending') as MovementStatus,
    created_at: String(r.created_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Paged movement query — GET /search/movements (movement.view). Server-side filters + pagination. */
export async function listMovements(filter: MovementFilter): Promise<PagedMovements> {
  const params = new URLSearchParams();
  if (filter.status !== 'all') params.set('status', filter.status);
  if (filter.movement_type !== 'all') params.set('movement_type', filter.movement_type);
  if (filter.asset_id) params.set('asset_id', filter.asset_id);
  if (filter.created_at_from) params.set('created_at_from', filter.created_at_from);
  if (filter.created_at_to) params.set('created_at_to', filter.created_at_to);
  params.set('page', String(filter.page));
  params.set('limit', String(filter.limit));
  const raw = await http.get<unknown>(`/search/movements?${params}`);
  const o = raw as { items?: unknown[]; total?: number; page?: number; limit?: number; hasMore?: boolean };
  const items = asArray(o?.items ?? raw)
    .map(mapMovement)
    .filter((m): m is MovementRow => m !== null);
  return {
    items,
    total: toNumber(o?.total, items.length),
    page: toNumber(o?.page, filter.page),
    limit: toNumber(o?.limit, filter.limit),
    hasMore: o?.hasMore === true,
  };
}

/** Single movement — GET /movements/:id (movement.view). */
export async function getMovement(id: string): Promise<MovementRow | null> {
  const raw = await http.get<unknown>(`/movements/${id}`);
  return mapMovement(raw);
}

/** Reference lookups for human-readable enrichment (same pattern as inventory). */
export async function getMovementLookups(): Promise<MovementLookups> {
  const [assetsRaw, locations, statuses, employees] = await Promise.all([
    http.get<unknown>('/assets?limit=500&page=1'),
    getLocations(),
    getStatuses(),
    getEmployees(),
  ]);
  const assets = new Map<string, { name: string; code: string }>();
  for (const a of asArray(assetsRaw)) {
    assets.set(String(a.id), { name: String(a.name ?? ''), code: String(a.full_asset_code ?? '') });
  }
  return {
    assets,
    locations: new Map(locations.map((l) => [l.id, l.full_path || l.name])),
    statuses: new Map(statuses.map((s) => [s.id, s])),
    employees: new Map(employees.map((e) => [e.id, e])),
  };
}

/** Enrich movements with human-readable names (mapper-level, presentation only). */
export function enrichMovements(rows: MovementRow[], lookups: MovementLookups): MovementRow[] {
  const loc = (id: string | null) => (id ? lookups.locations.get(id) ?? null : null);
  const emp = (id: string | null) => (id ? lookups.employees.get(id)?.name ?? null : null);
  const st = (id: string | null) => (id ? lookups.statuses.get(id)?.name ?? null : null);
  return rows.map((m) => ({
    ...m,
    _assetName: lookups.assets.get(m.asset_id)?.name,
    _assetCode: lookups.assets.get(m.asset_id)?.code,
    _fromLocation: loc(m.from_location_id),
    _toLocation: loc(m.to_location_id),
    _fromEmployee: emp(m.from_employee_id),
    _toEmployee: emp(m.to_employee_id),
    _fromStatus: st(m.from_status_id),
    _toStatus: st(m.to_status_id),
  }));
}

// ---------------------------------------------------------------------------
// Approval workflow (backend-authoritative; UI never mutates state locally)
// ---------------------------------------------------------------------------

/** Approve a pending movement — PATCH /movements/:id/approve (movement.approve).
 *  Backend applies the effect to the asset (BR-MOV-002) then flips status. */
export async function approveMovement(id: string): Promise<MovementRow | null> {
  const raw = await http.patch<unknown>(`/movements/${id}/approve`, {});
  return mapMovement(raw);
}

/** Reject a pending movement — PATCH /movements/:id/reject (movement.reject).
 *  Backend changes no asset state. */
export async function rejectMovement(id: string): Promise<MovementRow | null> {
  const raw = await http.patch<unknown>(`/movements/${id}/reject`, {});
  return mapMovement(raw);
}

/** Download the movements export (GET /exports/movements, export.movements). */
export async function downloadMovementsExport(format: 'csv' | 'xlsx' | 'pdf' = 'csv'): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_BASE_URL}/exports/movements?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `movements-export.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

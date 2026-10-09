/**
 * Asset Experience API layer (PRE-P3.2.2).
 * Responsible ONLY for fetching raw data and routing it through the centralized
 * mapping layer (mappers/). All response normalization / DTO transformation /
 * name resolution lives in mappers/, never here or in pages/components/hooks.
 * Mock mode remains a controlled development fallback (AUTH_MODE=mock).
 */
import { http, API_BASE_URL, ApiError } from '@/lib/api/client';
import {
  AssetAnalyticsSummary,
  AssetDepreciation,
  AssetDetail,
  AssetMovement,
  AssetQuery,
  AssetSummary,
  AuditEvent,
  LifecycleState,
  LifecycleTransitions,
  PagedAssets,
} from './types';
import {
  mapAnalytics,
  mapDashboardTotalValue,
  mapAssetDetail,
  mapAssetMovements,
  mapAuditEvents,
  mapLifecycleState,
  mapLifecycleTransitions,
  mapPagedAssets,
  NameLookup,
  EMPTY_NAMES,
} from './mappers';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'real';

export type { AssetDetail, AssetSummary, AssetMovement, AuditEvent } from './types';

export interface CategoryOption { value: string; label: string; }

/** Load categories for filters (real backend with mock fallback). */
export async function getCategories(token?: string | null): Promise<CategoryOption[]> {
  if (AUTH_MODE !== 'real') return mockCategories();
  const raw = await http.get<unknown>('/categories', token);
  return mapCategories(raw);
}

/** Centralized category mapping — accepts array or wrapped responses. */
export function mapCategories(raw: unknown): CategoryOption[] {
  const list = Array.isArray(raw) ? raw : (raw as { items?: unknown[]; data?: unknown[] })?.items ?? (raw as { data?: unknown[] })?.data ?? [];
  return (Array.isArray(list) ? list : [])
    .map((c) => {
      const o = c as { id?: string; name?: string; full_path?: string };
      return { value: String(o.id ?? ''), label: String(o.full_path ?? o.name ?? o.id ?? '') };
    })
    .filter((c) => c.value !== '');
}

function mockCategories(): CategoryOption[] {
  return [
    { value: 'it', label: 'IT' },
    { value: 'machinery', label: 'Machinery' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'furniture', label: 'Furniture' },
  ];
}

export async function getAnalyticsSummary(token?: string | null): Promise<AssetAnalyticsSummary> {
  if (AUTH_MODE !== 'real') return mockAnalytics();

  const [raw, dashboardRaw] = await Promise.all([
    http.get<unknown>('/assets/analytics/summary', token),
    // The richer read model is optional for graceful compatibility with older
    // backend previews; the existing analytics contract remains authoritative.
    http.get<unknown>('/dashboard/assets', token).catch(() => undefined),
  ]);
  const summary = mapAnalytics(raw);
  const totalValue = mapDashboardTotalValue(dashboardRaw);
  return totalValue === undefined ? summary : { ...summary, total_value: totalValue };
}

export async function searchAssets(
  query: AssetQuery,
  token?: string | null,
  names: NameLookup = EMPTY_NAMES,
): Promise<PagedAssets> {
  if (AUTH_MODE !== 'real') return mockSearch(query);
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category_id) params.set('category_id', query.category_id);
  if (query.location_id) params.set('location_id', query.location_id);
  if (query.status_id) params.set('status_id', query.status_id);
  if (query.employee_id) params.set('employee_id', query.employee_id);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 20));
  const raw = await http.get<unknown>(`/assets?${params}`, token);
  return mapPagedAssets(raw, names);
}

export async function getAsset(id: string, token?: string | null, names: NameLookup = EMPTY_NAMES): Promise<AssetDetail> {
  if (AUTH_MODE !== 'real') return mockAssetDetail(id);
  const raw = await http.get<unknown>(`/assets/${id}`, token);
  const mapped = mapAssetDetail(raw, names);
  // P0 fix (UX-01): never fabricate a mock asset in real mode. An unmappable
  // payload (e.g. empty 200 for a deactivated/disposed asset) is an honest
  // "not found" — the page renders its standard error state with retry.
  if (!mapped) throw new ApiError(404, 'Asset not found or no longer active.', 'ASSET_NOT_FOUND');
  return mapped;
}

/** Load the live depreciation calculation from the backend for an asset. */
export async function getAssetDepreciation(id: string, token?: string | null): Promise<AssetDepreciation | null> {
  if (AUTH_MODE !== 'real') return null;
  return http.get<AssetDepreciation | null>(`/assets/${id}/depreciation`, token);
}

export async function getLifecycleState(id: string, token?: string | null): Promise<LifecycleState> {
  if (AUTH_MODE !== 'real') return mockLifecycle(id);
  const raw = await http.get<unknown>(`/lifecycle/assets/${id}/state`, token);
  return mapLifecycleState(raw) ?? { assetId: id, state: '', timestamp: '' };
}

export async function getLifecycleTransitions(id: string, token?: string | null): Promise<LifecycleTransitions> {
  if (AUTH_MODE !== 'real') return mockTransitions(id);
  const raw = await http.get<unknown>(`/lifecycle/assets/${id}/transitions`, token);
  return mapLifecycleTransitions(raw) ?? { assetId: id, state: '', allowedTransitions: [] };
}

export async function getAssetMovements(id: string, token?: string | null): Promise<AssetMovement[]> {
  if (AUTH_MODE !== 'real') return mockMovements(id);
  const raw = await http.get<unknown>(`/assets/${id}/movements`, token);
  return mapAssetMovements(raw);
}

export async function getAssetAudit(id: string, token?: string | null): Promise<AuditEvent[]> {
  if (AUTH_MODE !== 'real') return mockAudit(id);
  const raw = await http.get<unknown>(`/audit/assets/${id}`, token);
  return mapAuditEvents(raw);
}

/** Load all reference names for human-readable display. Returns lookup maps. */
export async function getReferenceNames(token?: string | null): Promise<NameLookup> {
  if (AUTH_MODE !== 'real') return EMPTY_NAMES;
  try {
    const [cats, locs, emps, stats] = await Promise.all([
      http.get<unknown>('/categories', token),
      http.get<unknown>('/locations', token),
      http.get<unknown>('/employees', token),
      http.get<unknown>('/statuses', token),
    ]);
    const categories = mapCategories(cats);
    const locations = mapCategories(locs);
    const employees = mapCategories(emps);
    const statuses = mapCategories(stats);
    return {
      categories: new Map(categories.map((c) => [c.value, c.label])),
      locations: new Map(locations.map((l) => [l.value, l.label])),
      employees: new Map(employees.map((e) => [e.value, e.label])),
      statuses: new Map(statuses.map((s) => [s.value, s.label])),
    };
  } catch {
    return EMPTY_NAMES;
  }
}

// ---------------------------------------------------------------------------
// Write operations (real backend mode only — no fake mutations)
// ---------------------------------------------------------------------------

export interface CreateAssetInput {
  name: string;
  description?: string;
  category_id: string;
  location_id: string;
  status_id: string;
  employee_id?: string | null;
  model_id?: string | null;
  quantity?: number;
  purchase_price?: number;
  purchase_date?: string | null;
  depreciation_rate?: number | null;
  useful_life?: number | null;
  serial_number?: string;
  barcode?: string;
  reference_number?: string;
  notes?: string;
}

export interface UpdateAssetInput {
  name?: string;
  description?: string;
  category_id?: string;
  model_id?: string | null;
  location_id?: string;
  quantity?: number;
  employee_id?: string | null;
  purchase_price?: number;
  notes?: string;
}

export interface BulkAssetUpdateInput {
  asset_ids: string[];
  location_id?: string;
  employee_id?: string | null;
  status_id?: string;
  notes?: string | null;
}

export interface BulkAssetUpdateResult {
  updated: string[];
  failed: { id: string; reason: string }[];
}

function assertRealMode(): void {
  if (AUTH_MODE !== 'real') {
    throw new Error('WRITE_MODE_UNAVAILABLE: mutations require the real backend (AUTH_MODE=real).');
  }
}

export async function createAsset(input: CreateAssetInput): Promise<AssetDetail> {
  assertRealMode();
  const raw = await http.post<unknown>('/assets', input);
  const mapped = mapAssetDetail(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<AssetDetail> {
  assertRealMode();
  const raw = await http.patch<unknown>(`/assets/${id}`, input);
  const mapped = mapAssetDetail(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function deleteAsset(id: string): Promise<void> {
  assertRealMode();
  await http.del(`/assets/${id}`);
}

export async function bulkUpdateAssets(input: BulkAssetUpdateInput): Promise<BulkAssetUpdateResult> {
  assertRealMode();
  return http.patch<BulkAssetUpdateResult>('/assets/bulk', input);
}

/** Transfer asset — POST /assets/:id/transfer: applies immediately (location/custodian/status)
 *  and records an append-only movement for history (BR-MOV-004). */
export async function transferAsset(
  id: string,
  input: { to_location_id?: string | null; to_employee_id?: string | null; reason?: string },
): Promise<void> {
  assertRealMode();
  await http.post<unknown>(`/assets/${id}/transfer`, input);
}

/** Dispose asset → creates a pending disposal movement (applied on approval). */
export async function disposeAsset(id: string, reason?: string): Promise<void> {
  assertRealMode();
  await http.patch<unknown>(`/assets/${id}/dispose`, { reason: reason || undefined });
}

/** Retire asset → creates a pending retirement movement (applied on approval). */
export async function retireAsset(id: string, reason?: string): Promise<void> {
  assertRealMode();
  await http.patch<unknown>(`/assets/${id}/retire`, { reason: reason || undefined });
}

/** Download an export file (csv/xlsx/pdf) streamed by GET /exports/{resource}. */
export async function downloadAssetExport(format: 'csv' | 'xlsx' | 'pdf' = 'csv'): Promise<void> {
  assertRealMode();
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_BASE_URL}/exports/assets?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `assets-export.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Mock data (no backend running) ----

const CATEGORIES = ['IT', 'Furniture', 'Vehicles', 'Machinery'];

function rnd(n: number) { return Math.floor(Math.random() * n); }

export function mockAnalytics(): AssetAnalyticsSummary {
  return {
    total_value: 18500000,
    total_assets: 12480,
    active_assets: 10420,
    assigned_assets: 7320,
    maintenance_assets: 86,
    disposed_assets: 940,
    archived_assets: 1034,
    by_category: [
      { name: 'IT', count: 5120 }, { name: 'Machinery', count: 2980 },
      { name: 'Vehicles', count: 2460 }, { name: 'Furniture', count: 1920 },
    ],
    by_location: [
      { name: 'HQ / IT', count: 4100 }, { name: 'Warehouse', count: 3600 },
      { name: 'DC / Rack 3', count: 2900 }, { name: 'HQ / Ops', count: 1880 },
    ],
    lifecycle_distribution: [
      { state: 'active', count: 6200 }, { state: 'assigned', count: 4220 },
      { state: 'registered', count: 1600 }, { state: 'disposed', count: 940 },
      { state: 'archived', count: 1034 }, { state: 'in_maintenance', count: 86 },
    ],
  };
}

export function mockSearch(_query: AssetQuery): PagedAssets {
  const items: AssetSummary[] = Array.from({ length: 12 }, (_, i) => ({
    id: `mock-${i + 1}`,
    name: `${CATEGORIES[rnd(4)]} Asset ${i + 1}`,
    full_asset_code: `2024-${String(1000 + i + 1)}`,
    base_asset_code: `2024-${String(1000 + i + 1)}`,
    quantity: 1,
    status_id: null,
    location_id: null,
    employee_id: i % 3 === 0 ? `emp-${i}` : null,
    purchase_price: (500 + i * 250).toFixed(2),
    is_active: true,
  }));
  return { items, total: items.length };
}

const STATES = ['registered', 'active', 'assigned', 'in_maintenance', 'transferred', 'disposed', 'archived'];
export function mockLifecycle(id: string): LifecycleState {
  return { assetId: id, state: STATES[rnd(STATES.length)], timestamp: new Date().toISOString() };
}
export function mockTransitions(id: string): LifecycleTransitions {
  const state = 'active';
  return {
    assetId: id,
    state,
    allowedTransitions: [
      { from: 'active', to: 'assigned', reason: 'Place under custody' },
      { from: 'active', to: 'in_maintenance', reason: 'Enter maintenance' },
      { from: 'active', to: 'transferred', reason: 'Transfer between locations' },
      { from: 'active', to: 'disposed', reason: 'Dispose asset' },
      { from: 'active', to: 'archived', reason: 'Archive asset' },
    ],
  };
}

const MTYPES: AssetMovement['movement_type'][] = ['assignment', 'transfer', 'return', 'disposal'];
export function mockMovements(id: string): AssetMovement[] {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `mv-${i + 1}`,
    asset_id: id,
    movement_type: MTYPES[i % MTYPES.length],
    from_location_id: null,
    to_location_id: null,
    from_employee_id: null,
    to_employee_id: null,
    reason: `Movement ${i + 1}`,
    status: 'approved',
    performed_by: null,
    created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  }));
}

export function mockAudit(id: string): AuditEvent[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `au-${i + 1}`,
    action_type: i === 0 ? 'ASSET_CREATED' : 'ASSET_UPDATED',
    entity: 'asset',
    entity_id: id,
    metadata: null,
    user_id: null,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

export function mockAssetDetail(id: string): AssetDetail {
  return {
    id,
    name: `Mock Asset ${id}`,
    full_asset_code: '2024-0001',
    base_asset_code: '2024-0001',
    description: 'Sample enterprise asset for the P2 preview.',
    quantity: 1,
    status_id: null,
    location_id: null,
    employee_id: null,
    purchase_price: '1200.00',
    is_active: true,
    category_id: null,
    model_id: null,
    serial_number: 'SN-123456',
    barcode: 'AX-0001',
    purchase_date: '2024-01-15',
    depreciation_rate: '20.00',
    useful_life: 5,
    reference_number: 'REF-001',
    notes: 'Demo asset.',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  };
}

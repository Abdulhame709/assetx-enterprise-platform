/**
 * Asset Experience API layer (PRE-P3.2.2).
 * Responsible ONLY for fetching raw data and routing it through the centralized
 * mapping layer (mappers/). All response normalization / DTO transformation /
 * name resolution lives in mappers/, never here or in pages/components/hooks.
 * Mock mode remains a controlled development fallback (AUTH_MODE=mock).
 */
import { http } from '@/lib/api/client';
import {
  AssetAnalyticsSummary,
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
  mapAssetDetail,
  mapAssetMovements,
  mapAuditEvents,
  mapLifecycleState,
  mapLifecycleTransitions,
  mapPagedAssets,
  NameLookup,
  EMPTY_NAMES,
} from './mappers';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'mock';

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
      const o = c as { id?: string; name?: string };
      return { value: String(o.id ?? ''), label: String(o.name ?? o.id ?? '') };
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
  const raw = await http.get<unknown>('/assets/analytics/summary', token);
  return mapAnalytics(raw);
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
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 20));
  const raw = await http.get<unknown>(`/assets?${params}`, token);
  return mapPagedAssets(raw, names);
}

export async function getAsset(id: string, token?: string | null, names: NameLookup = EMPTY_NAMES): Promise<AssetDetail> {
  if (AUTH_MODE !== 'real') return mockAssetDetail(id);
  const raw = await http.get<unknown>(`/assets/${id}`, token);
  return mapAssetDetail(raw, names) ?? mockAssetDetail(id);
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
    const [cats, locs] = await Promise.all([
      http.get<unknown>('/categories', token),
      http.get<unknown>('/locations', token),
    ]);
    const categories = mapCategories(cats);
    const locations = mapCategories(locs);
    return {
      categories: new Map(categories.map((c) => [c.value, c.label])),
      locations: new Map(locations.map((l) => [l.value, l.label])),
      employees: new Map<string, string>(),
      statuses: new Map<string, string>(),
    };
  } catch {
    return EMPTY_NAMES;
  }
}

// ---- Mock data (no backend running) ----

const CATEGORIES = ['IT', 'Furniture', 'Vehicles', 'Machinery'];

function rnd(n: number) { return Math.floor(Math.random() * n); }

export function mockAnalytics(): AssetAnalyticsSummary {
  return {
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

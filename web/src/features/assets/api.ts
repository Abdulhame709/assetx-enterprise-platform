/**
 * Asset Experience API layer (Phase P2).
 * Wraps the existing backend endpoints + new P2 read endpoints. In mock mode
 * (no backend running) returns locally-generated data so the UI is browsable.
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

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'mock';
export const TOKEN = 'mock.assetx'; // session token placeholder for client-side calls

export async function getAnalyticsSummary(token?: string | null): Promise<AssetAnalyticsSummary> {
  if (AUTH_MODE !== 'real') return mockAnalytics();
  return http.get<AssetAnalyticsSummary>('/assets/analytics/summary', token ?? TOKEN);
}

export async function searchAssets(query: AssetQuery, token?: string | null): Promise<PagedAssets> {
  if (AUTH_MODE !== 'real') return mockSearch(query);
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category_id) params.set('category_id', query.category_id);
  if (query.location_id) params.set('location_id', query.location_id);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 20));
  return http.get<PagedAssets>(`/assets?${params}`, token ?? TOKEN);
}

export async function getAsset(id: string, token?: string | null): Promise<AssetDetail> {
  if (AUTH_MODE !== 'real') return mockAssetDetail(id);
  return http.get<AssetDetail>(`/assets/${id}`, token ?? TOKEN);
}

export async function getLifecycleState(id: string, token?: string | null): Promise<LifecycleState> {
  if (AUTH_MODE !== 'real') return mockLifecycle(id);
  return http.get<LifecycleState>(`/lifecycle/assets/${id}/state`, token ?? TOKEN);
}

export async function getLifecycleTransitions(id: string, token?: string | null): Promise<LifecycleTransitions> {
  if (AUTH_MODE !== 'real') return mockTransitions(id);
  return http.get<LifecycleTransitions>(`/lifecycle/assets/${id}/transitions`, token ?? TOKEN);
}

export async function getAssetMovements(id: string, token?: string | null): Promise<AssetMovement[]> {
  if (AUTH_MODE !== 'real') return mockMovements(id);
  return http.get<AssetMovement[]>(`/assets/${id}/movements`, token ?? TOKEN);
}

export async function getAssetAudit(id: string, token?: string | null): Promise<AuditEvent[]> {
  if (AUTH_MODE !== 'real') return mockAudit(id);
  const res = await http.get<{ items: AuditEvent[] }>(`/audit/assets/${id}`, token ?? TOKEN);
  return res.items;
}

// ---- Mock data (no backend running) ----

const CATEGORIES = ['IT', 'Furniture', 'Vehicles', 'Machinery'];
const LOCATIONS = ['HQ / IT', 'HQ / Ops', 'Warehouse', 'DC / Rack 3'];

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

export function mockSearch(query: AssetQuery): PagedAssets {
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

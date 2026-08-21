/**
 * Inventory feature API — real contract with the NestJS inventory module.
 * Reference: backend InventoryController · RecordService/CycleService/InventoryResultService
 * States come from schema enums:
 *   cycle_status:     new → in_progress → closed (BR-INV-002 terminal)
 *   inventory_result: matched/deficit/surplus/transferred/missing/not_inventoried (computed, ADL-006)
 */
import { http } from '@/lib/api/client';
import { getStatuses, getEmployees, ReferenceEmployee, ReferenceStatus } from '@/features/reference/api';
import { getLocations } from '@/features/locations/api';

// ---------------------------------------------------------------------------
// Types (mirror backend entities; names resolved at mapper level, never in pages)
// ---------------------------------------------------------------------------

export type CycleStatus = 'new' | 'in_progress' | 'closed';
export type InventoryResult = 'matched' | 'deficit' | 'surplus' | 'transferred' | 'missing' | 'not_inventoried';

export interface InventoryCycle {
  id: string;
  year: number;
  status: CycleStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface CycleSummary {
  cycle_id: string;
  status: CycleStatus;
  expected_assets: number;
  inventoried: number;
  found: number;        // matched
  missing: number;
  extra: number;        // surplus
  deficit: number;
  transferred: number;
  not_inventoried: number;
  variance: number;     // found - expected
  completion: number;   // % inventoried
}

export interface MobileInventorySnapshotRecord {
  record_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  expected_location_id: string | null;
  expected_location: string | null;
  expected_location_path: string | null;
  actual_location_id: string | null;
  actual_location: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  result: InventoryResult;
  inventory_date: string | null;
  notes: string | null;
  is_verified: boolean;
  updated_at: string | null;
}

export interface MobileInventorySnapshot {
  cycle: InventoryCycle;
  records: MobileInventorySnapshotRecord[];
}

export interface LocationInventorySuggestion {
  record_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  expected_location: string | null;
  actual_location: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  riskScore: number;
  riskLevel: 'medium' | 'high';
  reasonCodes: Array<'LOCATION_MISMATCH' | 'QUANTITY_VARIANCE' | 'LOCATION_UNRESOLVED'>;
  recommendedAction: 'review_location' | 'confirm_transfer';
  requiresHumanConfirmation: true;
}

export interface InventoryRecordRow {
  id: string;
  cycle_id: string;
  asset_id: string;
  expected_location_id: string | null;
  expected_quantity: number | null;
  expected_status_id: string | null;
  expected_employee_id: string | null;
  actual_location_id: string | null;
  actual_quantity: number | null;
  actual_status_id: string | null;
  actual_employee_id: string | null;
  inventory_date: string | null;
  is_verified: boolean;
  notes: string | null;
  result: InventoryResult;
  // resolved display fields (mapper enrichment)
  _assetName?: string;
  _assetCode?: string;
  _expectedLocation?: string | null;
  _expectedStatus?: string | null;
  _expectedEmployee?: string | null;
  _actualLocation?: string | null;
  _actualStatus?: string | null;
  _actualEmployee?: string | null;
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

export function mapCycle(raw: unknown): InventoryCycle | null {
  const r = raw as Record<string, unknown>;
  if (!r?.id) return null;
  return {
    id: String(r.id),
    year: toNumber(r.year),
    status: String(r.status ?? 'new') as CycleStatus,
    start_date: r.start_date != null ? String(r.start_date) : null,
    end_date: r.end_date != null ? String(r.end_date) : null,
    created_at: String(r.created_at ?? ''),
  };
}

export function mapSummary(raw: unknown): CycleSummary | null {
  const r = raw as Record<string, unknown>;
  if (!r?.cycle_id) return null;
  return {
    cycle_id: String(r.cycle_id),
    status: String(r.status ?? 'new') as CycleStatus,
    expected_assets: toNumber(r.expected_assets),
    inventoried: toNumber(r.inventoried),
    found: toNumber(r.found),
    missing: toNumber(r.missing),
    extra: toNumber(r.extra),
    deficit: toNumber(r.deficit),
    transferred: toNumber(r.transferred),
    not_inventoried: toNumber(r.not_inventoried),
    variance: toNumber(r.variance),
    completion: toNumber(r.completion),
  };
}

export function mapRecord(raw: unknown): InventoryRecordRow | null {
  const r = raw as Record<string, unknown>;
  if (!r?.id) return null;
  return {
    id: String(r.id),
    cycle_id: String(r.cycle_id ?? ''),
    asset_id: String(r.asset_id ?? ''),
    expected_location_id: r.expected_location_id != null ? String(r.expected_location_id) : null,
    expected_quantity: r.expected_quantity != null ? toNumber(r.expected_quantity) : null,
    expected_status_id: r.expected_status_id != null ? String(r.expected_status_id) : null,
    expected_employee_id: r.expected_employee_id != null ? String(r.expected_employee_id) : null,
    actual_location_id: r.actual_location_id != null ? String(r.actual_location_id) : null,
    actual_quantity: r.actual_quantity != null ? toNumber(r.actual_quantity) : null,
    actual_status_id: r.actual_status_id != null ? String(r.actual_status_id) : null,
    actual_employee_id: r.actual_employee_id != null ? String(r.actual_employee_id) : null,
    inventory_date: r.inventory_date != null ? String(r.inventory_date) : null,
    is_verified: r.is_verified === true,
    notes: r.notes != null ? String(r.notes) : null,
    result: String(r.result ?? 'not_inventoried') as InventoryResult,
  };
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

export async function getCycles(): Promise<InventoryCycle[]> {
  const raw = await http.get<unknown>('/inventory/cycles');
  const rows = asArray(raw).map(mapCycle).filter((c): c is InventoryCycle => c !== null);
  return rows.sort((a, b) => b.year - a.year);
}

export async function getCycle(id: string): Promise<InventoryCycle | null> {
  const raw = await http.get<unknown>(`/inventory/cycles/${id}`);
  return mapCycle(raw);
}

export interface CreateCycleInput {
  year: number;
  scope?: { all?: boolean; location_id?: string | null; category_id?: string | null };
}

export async function createCycle(input: CreateCycleInput): Promise<{ cycle: InventoryCycle; snapshotCount: number }> {
  const raw = await http.post<unknown>('/inventory/cycles', {
    year: input.year,
    scope: input.scope,
  });
  const r = raw as { cycle?: unknown; snapshotCount?: unknown; snapshot_count?: unknown };
  const cycle = mapCycle(r?.cycle);
  if (!cycle) throw new Error('Unexpected server response');
  return { cycle, snapshotCount: toNumber(r.snapshotCount ?? r.snapshot_count) };
}

export async function startCycle(id: string): Promise<InventoryCycle> {
  const raw = await http.patch<unknown>(`/inventory/cycles/${id}/start`, {});
  const cycle = mapCycle(raw);
  if (!cycle) throw new Error('Unexpected server response');
  return cycle;
}

export async function closeCycle(id: string): Promise<InventoryCycle> {
  const raw = await http.patch<unknown>(`/inventory/cycles/${id}/close`, {});
  const cycle = mapCycle(raw);
  if (!cycle) throw new Error('Unexpected server response');
  return cycle;
}

export async function getSummary(cycleId: string): Promise<CycleSummary | null> {
  const raw = await http.get<unknown>(`/inventory/cycles/${cycleId}/summary`);
  return mapSummary(raw);
}

function mapMobileSnapshotRecord(raw: unknown): MobileInventorySnapshotRecord | null {
  const r = raw as Record<string, unknown>;
  if (!r?.record_id) return null;
  return {
    record_id: String(r.record_id),
    asset_id: String(r.asset_id ?? ''),
    asset_code: String(r.asset_code ?? ''),
    asset_name: String(r.asset_name ?? ''),
    expected_location_id: r.expected_location_id != null ? String(r.expected_location_id) : null,
    expected_location: r.expected_location != null ? String(r.expected_location) : null,
    expected_location_path: r.expected_location_path != null ? String(r.expected_location_path) : null,
    actual_location_id: r.actual_location_id != null ? String(r.actual_location_id) : null,
    actual_location: r.actual_location != null ? String(r.actual_location) : null,
    expected_quantity: r.expected_quantity != null ? toNumber(r.expected_quantity) : null,
    actual_quantity: r.actual_quantity != null ? toNumber(r.actual_quantity) : null,
    result: String(r.result ?? 'not_inventoried') as InventoryResult,
    inventory_date: r.inventory_date != null ? String(r.inventory_date) : null,
    notes: r.notes != null ? String(r.notes) : null,
    is_verified: r.is_verified === true,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
  };
}

/** Download the tenant-scoped cycle payload used by a field/mobile client. */
export async function getMobileSnapshot(cycleId: string): Promise<MobileInventorySnapshot> {
  const raw = await http.get<unknown>(`/inventory/cycles/${cycleId}/mobile-snapshot`);
  const payload = raw as { cycle?: unknown; records?: unknown[] } | null;
  const cycle = mapCycle(payload?.cycle);
  if (!cycle) throw new Error('Unexpected server response');
  const records = (payload?.records ?? [])
    .map(mapMobileSnapshotRecord)
    .filter((record): record is MobileInventorySnapshotRecord => record !== null);
  return { cycle, records };
}

export async function getLocationSuggestions(cycleId: string): Promise<LocationInventorySuggestion[]> {
  const raw = await http.get<unknown>(`/inventory/cycles/${cycleId}/location-suggestions`);
  const suggestions = (raw as { suggestions?: unknown[] } | null)?.suggestions ?? [];
  return suggestions.map((value) => {
    const row = value as Record<string, unknown>;
    const riskLevel: LocationInventorySuggestion['riskLevel'] = row.riskLevel === 'high' ? 'high' : 'medium';
    const recommendedAction: LocationInventorySuggestion['recommendedAction'] = row.recommendedAction === 'review_location' ? 'review_location' : 'confirm_transfer';
    return {
      record_id: String(row.record_id ?? ''),
      asset_id: String(row.asset_id ?? ''),
      asset_code: String(row.asset_code ?? ''),
      asset_name: String(row.asset_name ?? ''),
      expected_location: row.expected_location != null ? String(row.expected_location) : null,
      actual_location: row.actual_location != null ? String(row.actual_location) : null,
      expected_quantity: row.expected_quantity != null ? toNumber(row.expected_quantity) : null,
      actual_quantity: row.actual_quantity != null ? toNumber(row.actual_quantity) : null,
      riskScore: toNumber(row.riskScore),
      riskLevel,
      reasonCodes: Array.isArray(row.reasonCodes)
        ? row.reasonCodes.filter((code): code is LocationInventorySuggestion['reasonCodes'][number] => code === 'LOCATION_MISMATCH' || code === 'QUANTITY_VARIANCE' || code === 'LOCATION_UNRESOLVED')
        : [],
      recommendedAction,
      requiresHumanConfirmation: true as const,
    };
  }).filter((suggestion) => suggestion.record_id !== '');
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export async function getRecords(cycleId: string): Promise<InventoryRecordRow[]> {
  const raw = await http.get<unknown>(`/inventory/cycles/${cycleId}/records`);
  return asArray(raw).map(mapRecord).filter((r): r is InventoryRecordRow => r !== null);
}

export interface RecordCountInput {
  actual_quantity: number;
  actual_location_id?: string | null;
  actual_status_id?: string | null;
  actual_employee_id?: string | null;
  notes?: string;
}

/** Record the actual count for a snapshot record of this asset (BR-INV flow). */
export async function recordCount(cycleId: string, assetId: string, input: RecordCountInput): Promise<void> {
  await http.post<unknown>(`/inventory/cycles/${cycleId}/records`, { asset_id: assetId, ...input });
}

/** Field-level update of a record (re-count; backend resets is_verified=false). */
export async function updateRecord(recordId: string, input: RecordCountInput): Promise<void> {
  await http.patch<unknown>(`/inventory/records/${recordId}`, input);
}

/** Verify or unverify a record (BR-INV-003: uncounted records cannot be verified). */
export async function verifyRecord(recordId: string, verified: boolean): Promise<void> {
  await http.patch<unknown>(`/inventory/records/${recordId}/verify`, { verified });
}

// ---------------------------------------------------------------------------
// Reference lookups for display resolution
// ---------------------------------------------------------------------------

export interface InventoryLookups {
  assets: Map<string, { name: string; code: string }>;
  locations: Map<string, string>;
  statuses: Map<string, ReferenceStatus>;
  employees: Map<string, ReferenceEmployee>;
}

export async function getInventoryLookups(): Promise<InventoryLookups> {
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

/** Enrich records with human-readable names (mapper-level, presentation only). */
export function enrichRecords(records: InventoryRecordRow[], lookups: InventoryLookups): InventoryRecordRow[] {
  const st = (id: string | null) => (id ? lookups.statuses.get(id)?.name ?? null : null);
  const emp = (id: string | null) => (id ? lookups.employees.get(id)?.name ?? null : null);
  const loc = (id: string | null) => (id ? lookups.locations.get(id) ?? null : null);
  return records.map((r) => ({
    ...r,
    _assetName: lookups.assets.get(r.asset_id)?.name ?? 'Unknown asset',
    _assetCode: lookups.assets.get(r.asset_id)?.code ?? '',
    _expectedLocation: loc(r.expected_location_id),
    _expectedStatus: st(r.expected_status_id),
    _expectedEmployee: emp(r.expected_employee_id),
    _actualLocation: loc(r.actual_location_id),
    _actualStatus: st(r.actual_status_id),
    _actualEmployee: emp(r.actual_employee_id),
  }));
}

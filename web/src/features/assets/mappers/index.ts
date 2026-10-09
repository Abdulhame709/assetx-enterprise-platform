/**
 * Asset Experience mappers (PRE-P3.2.2).
 * The single reference layer that transforms backend DTOs into frontend domain
 * models + human-readable presentation values. Business logic is NOT here — only
 * field mapping, array/object normalization, and human formatting.
 *
 * Centralized here so that:
 *   - API client, hooks, pages, and components never duplicate transformations.
 *   - A future backend contract change only requires editing this file.
 *   - Raw UUIDs / internal codes are never shown to end users (fallback instead).
 */
import {
  AssetAnalyticsSummary,
  AssetDetail,
  AssetMovement,
  AssetSummary,
  AuditEvent,
  LifecycleState,
  LifecycleTransitions,
  PagedAssets,
} from '../types';
import { normalizeList, normalizeObject, normalizePaged, toBool, toNumber, humanId } from './normalize';

/** A reference lookup (id → human label) used for name resolution. */
export interface NameLookup {
  categories: Map<string, string>;
  locations: Map<string, string>;
  employees: Map<string, string>;
  statuses: Map<string, string>;
}

export const EMPTY_NAMES: NameLookup = {
  categories: new Map(),
  locations: new Map(),
  employees: new Map(),
  statuses: new Map(),
};

export function buildNameLookup(
  categories: Array<{ id: string; name: string }>,
  locations: Array<{ id: string; name: string }>,
  employees: Array<{ id: string; name: string }>,
  statuses: Array<{ id: string; name: string }>,
): NameLookup {
  return {
    categories: new Map(categories.map((c) => [c.id, c.name])),
    locations: new Map(locations.map((l) => [l.id, l.name])),
    employees: new Map(employees.map((e) => [e.id, e.name])),
    statuses: new Map(statuses.map((s) => [s.id, s.name])),
  };
}

/** Human-readable value for a reference id; falls back to a placeholder. */
export function resolveName(lookup: NameLookup, kind: keyof NameLookup, id: unknown, placeholder = '—'): string {
  if (id === null || id === undefined || id === '') return placeholder;
  const key = String(id);
  return lookup[kind].get(key) ?? humanId(key, placeholder);
}

// ---------------------------------------------------------------------------
// Asset mapping
// ---------------------------------------------------------------------------

/** Map a raw asset row (list item) into the AssetSummary domain model. */
export function mapAssetSummary(raw: unknown, names: NameLookup = EMPTY_NAMES): AssetSummary | null {
  const r = normalizeObject<Record<string, unknown>>(raw);
  if (!r) return null;
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? '—'),
    full_asset_code: String(r.full_asset_code ?? r.code ?? ''),
    base_asset_code: String(r.base_asset_code ?? ''),
    quantity: toNumber(r.quantity, 1),
    status_id: r.status_id != null ? String(r.status_id) : null,
    location_id: r.location_id != null ? String(r.location_id) : null,
    employee_id: r.employee_id != null ? String(r.employee_id) : null,
    purchase_price: String(r.purchase_price ?? '0'),
    is_active: toBool(r.is_active, true),
    // human-readable display fields (presentation enrichment, not backend fields)
    _categoryName: resolveName(names, 'categories', r.category_id),
    _locationName: resolveName(names, 'locations', r.location_id),
    _employeeName: resolveName(names, 'employees', r.employee_id),
    _statusName: resolveName(names, 'statuses', r.status_id),
  };
}

/** Map a raw asset detail into the AssetDetail domain model. */
export function mapAssetDetail(raw: unknown, names: NameLookup = EMPTY_NAMES): AssetDetail | null {
  const r = normalizeObject<Record<string, unknown>>(raw);
  if (!r) return null;
  const base = mapAssetSummary(r, names);
  if (!base) return null;
  return {
    ...base,
    description: r.description != null ? String(r.description) : null,
    category_id: r.category_id != null ? String(r.category_id) : null,
    model_id: r.model_id != null ? String(r.model_id) : null,
    serial_number: r.serial_number != null ? String(r.serial_number) : null,
    barcode: r.barcode != null ? String(r.barcode) : null,
    purchase_date: r.purchase_date != null ? String(r.purchase_date) : null,
    depreciation_rate: r.depreciation_rate != null ? String(r.depreciation_rate) : null,
    useful_life: r.useful_life != null ? toNumber(r.useful_life, 0) : null,
    reference_number: r.reference_number != null ? String(r.reference_number) : null,
    notes: r.notes != null ? String(r.notes) : null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  };
}

/** Map a raw paged response into { items, total }. */
export function mapPagedAssets(raw: unknown, names: NameLookup = EMPTY_NAMES): PagedAssets {
  const { items: rawItems, total } = normalizePaged<Record<string, unknown>>(raw);
  const items = rawItems
    .map((r) => mapAssetSummary(r, names))
    .filter((a): a is AssetSummary => a !== null);
  return { items, total };
}

// ---------------------------------------------------------------------------
// Audit / movement / lifecycle / analytics mapping
// ---------------------------------------------------------------------------

export function mapAuditEvents(raw: unknown): AuditEvent[] {
  return normalizeList<Record<string, unknown>>(raw)
    .map((r) => ({
      id: String(r.id ?? ''),
      action_type: String(r.action_type ?? r.action ?? ''),
      entity: String(r.entity ?? ''),
      entity_id: String(r.entity_id ?? r.entityId ?? ''),
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      user_id: r.user_id != null ? String(r.user_id) : null,
      created_at: String(r.created_at ?? ''),
    }))
    .filter((e) => e.action_type !== '');
}

export function mapAssetMovements(raw: unknown): AssetMovement[] {
  return normalizeList<Record<string, unknown>>(raw)
    .map((r) => ({
      id: String(r.id ?? ''),
      asset_id: String(r.asset_id ?? ''),
      movement_type: String(r.movement_type ?? '') as AssetMovement['movement_type'],
      from_location_id: r.from_location_id != null ? String(r.from_location_id) : null,
      to_location_id: r.to_location_id != null ? String(r.to_location_id) : null,
      from_employee_id: r.from_employee_id != null ? String(r.from_employee_id) : null,
      to_employee_id: r.to_employee_id != null ? String(r.to_employee_id) : null,
      reason: r.reason != null ? String(r.reason) : null,
      status: String(r.status ?? '') as AssetMovement['status'],
      performed_by: r.performed_by != null ? String(r.performed_by) : null,
      created_at: String(r.created_at ?? ''),
    }))
    .filter((m) => m.id !== '');
}

export function mapLifecycleState(raw: unknown): LifecycleState | null {
  const r = normalizeObject<Record<string, unknown>>(raw);
  if (!r) return null;
  return {
    assetId: String(r.assetId ?? r.asset_id ?? ''),
    state: String(r.state ?? ''),
    timestamp: String(r.timestamp ?? ''),
  };
}

export function mapLifecycleTransitions(raw: unknown): LifecycleTransitions | null {
  const r = normalizeObject<Record<string, unknown>>(raw);
  if (!r) return null;
  const allowed = normalizeList<Record<string, unknown>>(r.allowedTransitions)
    .map((t) => ({
      from: String(t.from ?? ''),
      to: String(t.to ?? ''),
      reason: t.reason != null ? String(t.reason) : undefined,
    }))
    .filter((t) => t.from !== '' && t.to !== '');
  return {
    assetId: String(r.assetId ?? r.asset_id ?? ''),
    state: String(r.state ?? ''),
    allowedTransitions: allowed,
  };
}

export function mapDashboardTotalValue(raw: unknown): number | undefined {
  const r = normalizeObject<Record<string, unknown>>(raw);
  if (!r || r.total_value === null || r.total_value === undefined) return undefined;
  return toNumber(r.total_value, 0);
}

export function mapAnalytics(raw: unknown): AssetAnalyticsSummary {
  const r = normalizeObject<Record<string, unknown>>(raw) ?? {};
  const toBuckets = (v: unknown) =>
    normalizeList<Record<string, unknown>>(v).map((b) => ({
      name: String(b.name ?? ''),
      count: toNumber(b.count, 0),
    }));
  const totalValue = mapDashboardTotalValue(raw);

  return {
    ...(totalValue === undefined ? {} : { total_value: totalValue }),
    total_assets: toNumber(r.total_assets, 0),
    active_assets: toNumber(r.active_assets, 0),
    assigned_assets: toNumber(r.assigned_assets, 0),
    maintenance_assets: toNumber(r.maintenance_assets, 0),
    disposed_assets: toNumber(r.disposed_assets, 0),
    archived_assets: toNumber(r.archived_assets, 0),
    by_category: toBuckets(r.by_category),
    by_location: toBuckets(r.by_location),
    lifecycle_distribution: normalizeList<Record<string, unknown>>(r.lifecycle_distribution).map((b) => ({
      // Backend contract sends `state` per bucket (verified live); `name`
      // kept as a defensive fallback only (P2 fix UX-05 — previously the
      // undefined state yielded empty legend labels + duplicate React keys).
      state: String(b.state ?? b.name ?? ''),
      count: toNumber(b.count, 0),
    })),
  };
}

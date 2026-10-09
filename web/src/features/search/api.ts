import { http } from '@/lib/api/client';
import { mapPagedAssets, NameLookup } from '@/features/assets/mappers';
import type { AssetSummary } from '@/features/assets/types';
import { normalizeList, normalizeObject, normalizePaged, toBool, toNumber } from '@/features/assets/mappers/normalize';

export type SearchResource = 'assets' | 'movements' | 'audit';
export type SortDirection = 'asc' | 'desc';

export interface AdvancedSearchQuery {
  q: string;
  filters: Record<string, unknown>;
  sort: string;
  dir: SortDirection;
  page: number;
  limit: number;
}

export interface SearchPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface MovementSearchItem {
  id: string;
  asset_id: string | null;
  movement_type: string;
  status: string;
  reason: string | null;
  reference_number: string | null;
  quantity: number | null;
  created_at: string;
}

export interface AuditSearchItem {
  id: string;
  action_type: string;
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
}

export type SearchItem = AssetSummary | MovementSearchItem | AuditSearchItem;

export interface SavedSearchRecord {
  id: string;
  name: string;
  resource: SearchResource;
  filters: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchCriteria {
  resource: SearchResource;
  filters: Record<string, unknown>;
}

function buildSearchParams(query: AdvancedSearchQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  for (const [key, value] of Object.entries(query.filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  params.set('sort', query.sort);
  params.set('dir', query.dir);
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  return params.toString();
}

function pageMeta(raw: unknown, query: AdvancedSearchQuery, total: number): Omit<SearchPage<never>, 'items'> {
  const object = normalizeObject<Record<string, unknown>>(raw);
  const page = typeof object?.page === 'number' ? object.page : query.page;
  const limit = typeof object?.limit === 'number' ? object.limit : query.limit;
  const hasMore = typeof object?.hasMore === 'boolean' ? object.hasMore : page * limit < total;
  return { total, page, limit, hasMore };
}

function mapMovementSearchItem(raw: unknown): MovementSearchItem | null {
  const item = normalizeObject<Record<string, unknown>>(raw);
  if (!item) return null;
  const id = String(item.id ?? '');
  if (!id) return null;
  return {
    id,
    asset_id: item.asset_id != null ? String(item.asset_id) : null,
    movement_type: String(item.movement_type ?? ''),
    status: String(item.status ?? ''),
    reason: item.reason != null ? String(item.reason) : null,
    reference_number: item.reference_number != null ? String(item.reference_number) : null,
    quantity: item.quantity != null ? toNumber(item.quantity, 0) : null,
    created_at: String(item.created_at ?? ''),
  };
}

function mapAuditSearchItem(raw: unknown): AuditSearchItem | null {
  const item = normalizeObject<Record<string, unknown>>(raw);
  if (!item) return null;
  const id = String(item.id ?? '');
  if (!id) return null;
  return {
    id,
    action_type: String(item.action_type ?? item.action ?? ''),
    entity: String(item.entity ?? item.table_name ?? ''),
    entity_id: item.entity_id != null ? String(item.entity_id) : item.record_id != null ? String(item.record_id) : null,
    user_id: item.user_id != null ? String(item.user_id) : null,
    created_at: String(item.created_at ?? ''),
  };
}

export async function searchResource(
  resource: SearchResource,
  query: AdvancedSearchQuery,
  names: NameLookup,
): Promise<SearchPage<SearchItem>> {
  const raw = await http.get<unknown>(`/search/${resource}?${buildSearchParams(query)}`);
  if (resource === 'assets') {
    const mapped = mapPagedAssets(raw, names);
    return { items: mapped.items, ...pageMeta(raw, query, mapped.total) };
  }
  const { items: rawItems, total } = normalizePaged<Record<string, unknown>>(raw);
  const items = resource === 'movements'
    ? rawItems.map(mapMovementSearchItem).filter((item): item is MovementSearchItem => item !== null)
    : rawItems.map(mapAuditSearchItem).filter((item): item is AuditSearchItem => item !== null);
  return { items, ...pageMeta(raw, query, total) };
}

export async function getSavedSearches(): Promise<SavedSearchRecord[]> {
  const raw = await http.get<unknown>('/search/saved');
  return normalizeList<Record<string, unknown>>(raw)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      resource: String(item.resource ?? 'assets') as SearchResource,
      filters: (item.filters as Record<string, unknown> | null) ?? {},
      is_default: toBool(item.is_default, false),
      version: toNumber(item.version, 1),
      created_at: String(item.created_at ?? ''),
      updated_at: String(item.updated_at ?? ''),
    }))
    .filter((item) => item.id && item.name);
}

export async function createSavedSearch(input: {
  name: string;
  resource: SearchResource;
  filters: Record<string, unknown>;
  is_default?: boolean;
}): Promise<SavedSearchRecord> {
  const raw = await http.post<unknown>('/search/saved', input);
  const item = normalizeObject<Record<string, unknown>>(raw);
  if (!item) throw new Error('Unexpected server response');
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? input.name),
    resource: String(item.resource ?? input.resource) as SearchResource,
    filters: (item.filters as Record<string, unknown> | null) ?? input.filters,
    is_default: toBool(item.is_default, input.is_default ?? false),
    version: toNumber(item.version, 1),
    created_at: String(item.created_at ?? ''),
    updated_at: String(item.updated_at ?? ''),
  };
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await http.del(`/search/saved/${id}`);
}

export async function executeSavedSearch(id: string): Promise<SavedSearchCriteria> {
  const raw = await http.get<unknown>(`/search/saved/${id}/execute`);
  const item = normalizeObject<Record<string, unknown>>(raw);
  if (!item) throw new Error('Unexpected server response');
  return {
    resource: String(item.resource ?? 'assets') as SearchResource,
    filters: (item.filters as Record<string, unknown> | null) ?? {},
  };
}

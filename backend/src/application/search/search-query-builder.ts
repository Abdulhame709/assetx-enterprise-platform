/**
 * SearchQueryBuilder — pure, DB-free query normalization/validation.
 * Maps raw query params into a repository-safe SearchCriteria per resource.
 * Reference: Advanced-Search-Design-Specification §3 · Business Spec §3-4
 */
import { Injectable } from '@nestjs/common';

export type ResourceType = 'assets' | 'movements' | 'audit';

export interface SearchCriteria {
  resource: ResourceType;
  q?: string;
  filters: Record<string, unknown>;      // normalized field -> value(s)/range
  sort?: { field: string; dir: 'asc' | 'desc' };
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Per-resource allow-list of sortable fields (prevents SQL injection via columns). */
const SORTABLE: Record<ResourceType, string[]> = {
  assets: ['name', 'full_asset_code', 'purchase_date', 'purchase_price', 'created_at', 'quantity'],
  movements: ['created_at', 'movement_type', 'status'],
  audit: ['created_at', 'action_type', 'table_name'],
};

@Injectable()
export class SearchQueryBuilder {
  build(resource: ResourceType, raw: Record<string, unknown>): SearchCriteria {
    const filters: Record<string, unknown> = {};
    const parsedPage = Number(raw.page ?? DEFAULT_PAGE);
    const parsedLimit = Number(raw.limit ?? DEFAULT_LIMIT);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : DEFAULT_PAGE;
    const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : DEFAULT_LIMIT, MAX_LIMIT);

    // free-text q
    const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim() : undefined;

    // copy known filter params (exclude control params)
    const control = new Set(['q', 'page', 'limit', 'sort', 'dir']);
    for (const [k, v] of Object.entries(raw)) {
      if (control.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      filters[k] = v;
    }

    // normalize sort
    let sort: SearchCriteria['sort'];
    const sortField = raw.sort ? String(raw.sort) : undefined;
    const dirRaw = raw.dir === 'desc' ? 'desc' : 'asc';
    if (sortField) {
      const allowed = SORTABLE[resource];
      if (allowed.includes(sortField)) sort = { field: sortField, dir: dirRaw };
    }
    if (!sort) sort = { field: resource === 'assets' ? 'name' : 'created_at', dir: resource === 'assets' ? 'asc' : 'desc' };

    return { resource, q, filters, sort, page, limit };
  }
}

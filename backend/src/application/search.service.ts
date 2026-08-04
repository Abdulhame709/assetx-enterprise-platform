/**
 * SearchService — advanced search orchestration.
 * Builds criteria, routes to the resource provider, returns results.
 * Performs permission checks (must be called after guards) and supports
 * grouped global search across providers.
 * Reference: Advanced-Search-Design-Specification §2 · Business Spec §6
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { SearchProvider, SearchResult } from '../core/ports/search-provider.port';
import { SearchCriteria, SearchQueryBuilder } from './search/search-query-builder';
import { DATABASE_PORT, SEARCH_PROVIDERS } from '../core/ports/tokens';

export interface GlobalSearchResult {
  query: string;
  assets: SearchResult;
  movements: SearchResult;
  audit: SearchResult;
}

@Injectable()
export class SearchService {
  private readonly providers = new Map<string, SearchProvider>();

  constructor(
    private readonly builder: SearchQueryBuilder,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    @Inject(SEARCH_PROVIDERS) providers: SearchProvider[],
  ) {
    for (const p of providers) this.providers.set(p.resource, p);
  }

  /** Search a specific resource. */
  async search(tenantId: string, resource: string, raw: Record<string, unknown>): Promise<SearchResult> {
    await this.db.setTenant(tenantId);
    const provider = this.providers.get(resource);
    if (!provider) throw new Error('UNSUPPORTED_SEARCH_RESOURCE');
    const criteria = this.builder.build(resource as never, raw);
    return provider.search(tenantId, criteria);
  }

  /** Global search across assets/movements/audit, grouped by resource (OD-4A). */
  async global(tenantId: string, q: string, raw: Record<string, unknown>): Promise<GlobalSearchResult> {
    await this.db.setTenant(tenantId);
    const base: Record<string, unknown> = { ...raw, q, limit: raw.limit ?? 20 };
    const [assets, movements, audit] = await Promise.all([
      this.search(tenantId, 'assets', base),
      this.search(tenantId, 'movements', base),
      this.search(tenantId, 'audit', base),
    ]);
    return { query: q, assets, movements, audit };
  }
}

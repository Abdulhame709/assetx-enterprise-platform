/**
 * SearchProvider port — each provider knows its own resource's search.
 * It translates a SearchCriteria into a repository call and returns items+total.
 * Reference: Advanced-Search-Design-Specification §2
 */
import { SearchCriteria } from '../../application/search/search-query-builder';

export interface SearchResult<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SearchProvider {
  readonly resource: string;
  search(tenantId: string, criteria: SearchCriteria): Promise<SearchResult>;
}

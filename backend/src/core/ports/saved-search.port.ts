/**
 * SavedSearchRepository port — abstract data access for saved searches.
 * Repository pattern: no business logic, tenant + user scoped, respects RLS.
 * Reference: ADR-011
 */
import { SavedSearch, SavedSearchResource } from '../entities/saved-search.entity';

export interface SavedSearchPort {
  create(input: {
    tenant_id: string;
    userId: string;
    name: string;
    resource: SavedSearchResource;
    filters: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch>;
  findById(id: string, tenantId: string, userId: string): Promise<SavedSearch | null>;
  list(tenantId: string, userId: string): Promise<SavedSearch[]>;
  update(id: string, tenantId: string, userId: string, patch: {
    name?: string;
    filters?: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch | null>;
  remove(id: string, tenantId: string, userId: string): Promise<boolean>;
  countByUser(tenantId: string, userId: string): Promise<number>;
  existsName(tenantId: string, userId: string, name: string, excludeId?: string): Promise<boolean>;
}

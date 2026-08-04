/**
 * SavedSearch entity — a user's persisted search filters (ADR-011).
 * Reference: Advanced-Search-Design-Specification §10 · ADR-011
 */

export type SavedSearchResource = 'assets' | 'movements' | 'audit';

export interface SavedSearch {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  resource: SavedSearchResource;
  filters: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

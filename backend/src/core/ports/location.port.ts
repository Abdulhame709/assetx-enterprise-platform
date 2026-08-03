/**
 * LocationRepository port — abstract data access for locations (Clean Architecture).
 */
import { Location } from '../entities/location.entity';

export interface CreateLocationInput {
  tenant_id: string;
  parent_id?: string | null;
  name: string;
  location_type?: Location['location_type'];
}

export interface UpdateLocationInput {
  name?: string;
  location_type?: Location['location_type'];
}

export interface LocationPort {
  create(input: CreateLocationInput): Promise<Location>;
  update(id: string, tenantId: string, input: UpdateLocationInput): Promise<Location | null>;
  findById(id: string, tenantId: string): Promise<Location | null>;
  /** List all locations for a tenant (hierarchical, ordered by path). */
  list(tenantId: string): Promise<Location[]>;
  /** Soft delete (is_active=false). Blocked if it has active child locations or assets. */
  softDelete(id: string, tenantId: string): Promise<boolean>;
  /** Duplicate name check within a tenant (and optional parent). */
  existsName(tenantId: string, name: string, parentId?: string | null, excludeId?: string): Promise<boolean>;
  /** Count active children for a location. */
  countChildren(id: string, tenantId: string): Promise<number>;
  /** Count active assets referencing a location. */
  countAssets(id: string, tenantId: string): Promise<number>;
}

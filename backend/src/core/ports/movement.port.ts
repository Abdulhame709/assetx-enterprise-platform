/**
 * MovementRepository port — abstract data access for asset movements.
 * Reference: Entity Spec §5.12 · Data Dictionary TB-MOVEMENT · ADR-007
 */
import { AssetMovement, MovementType, MovementStatus } from '../entities/movement.entity';

export interface CreateMovementInput {
  tenant_id: string;
  asset_id: string;
  movement_type: MovementType;
  from_location_id?: string | null;
  to_location_id?: string | null;
  from_employee_id?: string | null;
  to_employee_id?: string | null;
  from_status_id?: string | null;
  to_status_id?: string | null;
  reason?: string | null;
  reference_number?: string | null;
  quantity?: number | null;
  notes?: string | null;
  performed_by?: string | null;
}

export interface MovementPort {
  create(input: CreateMovementInput): Promise<AssetMovement>;
  findById(id: string, tenantId: string): Promise<AssetMovement | null>;
  listByAsset(assetId: string, tenantId: string): Promise<AssetMovement[]>;
  list(tenantId: string, filter?: { status?: MovementStatus; movement_type?: MovementType }): Promise<AssetMovement[]>;
  /** advanced search with date/user filters + pagination + sorting (Phase 11.4) */
  searchAdvanced(tenantId: string, q: {
    status?: MovementStatus;
    movement_type?: MovementType;
    performed_by?: string;
    asset_id?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AssetMovement[]; total: number }>;
  setStatus(id: string, tenantId: string, status: MovementStatus, approverId: string): Promise<AssetMovement | null>;
  /** Whether there is a pending movement of the same type for the asset (validation). */
  hasPending(id: string, assetId: string, tenantId: string, type: MovementType, excludeId?: string): Promise<boolean>;
}

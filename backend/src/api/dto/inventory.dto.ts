/**
 * Inventory request DTOs.
 * Reference: API Spec (DOC-10) §7 Inventory
 */

export interface CycleScopeDto {
  all?: boolean;
  location_id?: string;
  category_id?: string;
}

export interface CreateCycleDto {
  year: number;
  scope?: CycleScopeDto;
}

export interface RecordResultDto {
  asset_id: string;
  actual_location_id?: string | null;
  actual_quantity?: number | null;
  actual_status_id?: string | null;
  actual_employee_id?: string | null;
  notes?: string | null;
}

export interface UpdateRecordDto {
  actual_location_id?: string | null;
  actual_quantity?: number | null;
  actual_status_id?: string | null;
  actual_employee_id?: string | null;
  notes?: string | null;
}

export interface VerifyRecordDto {
  verified: boolean;
}

export type InventorySyncMode = 'record' | 'update';

export interface InventorySyncMutationDto {
  mutation_id: string;
  record_id: string;
  asset_id: string;
  mode: InventorySyncMode;
  base_updated_at: string | null;
  payload: Omit<RecordResultDto, 'asset_id'>;
}

export interface InventorySyncDto {
  mutations: InventorySyncMutationDto[];
}

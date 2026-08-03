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
  actual_location_id?: string;
  actual_quantity?: number;
  actual_status_id?: string;
  actual_employee_id?: string;
  notes?: string;
}

export interface UpdateRecordDto {
  actual_location_id?: string;
  actual_quantity?: number;
  actual_status_id?: string;
  actual_employee_id?: string;
  notes?: string;
}

export interface VerifyRecordDto {
  verified: boolean;
}

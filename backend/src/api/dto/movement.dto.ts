/**
 * Movement request DTOs.
 * Reference: API Spec (DOC-10) · FRS FR-MOV-* · ADR-007
 */

export type MovementTypeDto =
  | 'transfer' | 'assignment' | 'return' | 'maintenance_return' | 'disposal' | 'retirement' | 'missing';

export interface CreateMovementDto {
  asset_id: string;
  movement_type: MovementTypeDto;
  to_location_id?: string;
  to_employee_id?: string;
  from_location_id?: string;
  from_employee_id?: string;
  reason?: string;
  reference_number?: string;
  quantity?: number;
  notes?: string;
}

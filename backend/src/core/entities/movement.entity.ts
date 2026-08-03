/**
 * AssetMovement entity — ENT-MOVEMENT (BC-MOVEMENT) — Aggregate Root.
 * Reference: Entity Spec (DOC-21) §5.12 · Data Dictionary (DOC-24) TB-MOVEMENT
 * ADR-007: extended lifecycle (6 movement types + approval status).
 */

export type MovementType =
  | 'transfer'            // نقل الأصل بين المواقع
  | 'assignment'          // عهدة موظف
  | 'return'              // إرجاع من الموظف
  | 'maintenance_return'  // عودة الأصل من الصيانة
  | 'disposal'            // استبعاد الأصل
  | 'retirement';         // إحالة للتقاعد

export type MovementStatus = 'pending' | 'approved' | 'rejected';

export interface AssetMovement {
  id: string;
  tenant_id: string;
  asset_id: string;
  movement_type: MovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_employee_id: string | null;
  to_employee_id: string | null;
  from_status_id: string | null;
  to_status_id: string | null;
  reason: string | null;
  reference_number: string | null;
  approved_by: string | null;
  quantity: number | null;
  notes: string | null;
  performed_by: string | null;
  status: MovementStatus;      // ADR-007
  approved_at: Date | null;    // ADR-007
  created_at: Date;
}

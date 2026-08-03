/**
 * Inventory entities — ENT-CYCLE (aggregate root), ENT-RECORD, result.
 * Reference: Entity Spec (DOC-21) §5.14–5.16 · Data Dictionary (DOC-24)
 * Field names match the database schema exactly; no new columns.
 */

/** Cycle status. Maps to schema enum cycle_status: new/in_progress/closed.
 *  Business states: Draft=new · Running=in_progress · Closed/Completed=closed. */
export type CycleStatus = 'new' | 'in_progress' | 'closed';

export interface InventoryCycle {
  id: string;
  tenant_id: string;
  year: number;
  status: CycleStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Scope definition for snapshot creation (BR-INV-001). */
export interface CycleScope {
  all?: boolean;
  location_id?: string;   // include descendants (LTREE)
  category_id?: string;
}

/** Inventory record — expected vs actual. Result is COMPUTED (ADL-006). */
export interface InventoryRecord {
  id: string;
  tenant_id: string;
  cycle_id: string;
  asset_id: string;
  expected_location_id: string | null;
  expected_quantity: number | null;
  expected_status_id: string | null;
  expected_employee_id: string | null;
  actual_location_id: string | null;
  actual_quantity: number | null;
  actual_status_id: string | null;
  actual_employee_id: string | null;
  inventory_date: string | null;
  inventory_by: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_date: Date | null;
  notes: string | null;
}

/** Computed result for a record (from v_inventory_result). */
export type InventoryResult =
  | 'matched' | 'deficit' | 'surplus' | 'transferred' | 'missing' | 'not_inventoried';

export interface InventoryRecordResult extends InventoryRecord {
  result: InventoryResult;
}

/** Aggregate summary from the Inventory Engine. */
export interface InventorySummary {
  cycle_id: string;
  status: CycleStatus;
  expected_assets: number;
  inventoried: number;
  found: number;      // matched
  missing: number;
  extra: number;      // surplus
  deficit: number;
  transferred: number;
  not_inventoried: number;
  variance: number;   // found - expected
  completion: number; // % inventoried
}

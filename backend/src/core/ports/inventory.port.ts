/**
 * Inventory repository ports — data access for cycles, records, and results.
 */
import {
  InventoryCycle,
  CycleScope,
  InventoryRecord,
  InventoryRecordResult,
  InventoryResult,
} from '../entities/inventory.entity';

// ---- Cycle ----
export interface CyclePort {
  create(tenantId: string, year: number): Promise<InventoryCycle>;
  findById(id: string, tenantId: string): Promise<InventoryCycle | null>;
  list(tenantId: string): Promise<InventoryCycle[]>;
  updateStatus(id: string, tenantId: string, status: InventoryCycle['status'], endDate?: boolean): Promise<InventoryCycle | null>;
  existsYear(tenantId: string, year: number, excludeId?: string): Promise<boolean>;
}

// ---- Records ----
export interface RecordInput {
  actual_location_id?: string | null;
  actual_quantity?: number | null;
  actual_status_id?: string | null;
  actual_employee_id?: string | null;
  notes?: string | null;
}

export interface RecordPort {
  /** Create the snapshot of active assets for a cycle (BR-INV-001). */
  createSnapshot(tenantId: string, cycleId: string, scope: CycleScope): Promise<number>;
  /** Update an actual inventory result for a record. */
  updateRecord(recordId: string, tenantId: string, input: RecordInput, userId: string): Promise<InventoryRecord | null>;
  listByCycle(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]>;
  findById(id: string, tenantId: string): Promise<InventoryRecord | null>;
  setVerified(recordId: string, tenantId: string, verified: boolean, userId: string): Promise<InventoryRecord | null>;
  /** Count inventoried (actual_quantity IS NOT NULL) records in a cycle. */
  countInventoried(cycleId: string, tenantId: string): Promise<number>;
}

// ---- Result Engine (uses v_inventory_result — ADL-006) ----
export interface ResultPort {
  /** Aggregated summary computed from v_inventory_result. */
  getSummary(cycleId: string, tenantId: string): Promise<InventorySummaryLike>;
  /** Raw computed results for a cycle. */
  getResults(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]>;
}

export interface InventorySummaryLike {
  cycle_id: string;
  status: string;
  expected_assets: number;
  inventoried: number;
  matched: number;
  missing: number;
  deficit: number;
  surplus: number;
  transferred: number;
  not_inventoried: number;
  variance: number;
  completion: number;
}

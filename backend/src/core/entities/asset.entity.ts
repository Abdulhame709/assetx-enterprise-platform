/**
 * Asset entity — ENT-ASSET (BC-ASSET) — Aggregate Root.
 * Reference: Entity Spec (DOC-21) §5.6 · Data Dictionary (DOC-24) TB-ASSET
 * Field names match the database schema exactly; no new columns.
 */
export interface Asset {
  id: string;
  tenant_id: string;
  name: string;
  base_asset_code: string;   // YYYY-NNNN (BR-CODE-001)
  full_asset_code: string;   // Base@Location (BR-ASSET-001)
  description: string | null;
  category_id: string | null;
  sub_type_id: string | null;
  model_id: string | null;
  location_id: string | null;
  quantity: number;          // > 0
  status_id: string | null;
  employee_id: string | null; // custodian
  purchase_price: string;    // decimal(18,2)
  purchase_date: string | null;
  depreciation_rate: string | null;
  useful_life: number | null;
  serial_number: string | null;
  barcode: string | null;
  reference_number: string | null;
  inventory_year: number | null;
  notes: string | null;
  is_active: boolean;        // soft delete (BR-ASSET-010)
  created_at: Date;
  updated_at: Date;
}

/** Minimal typed asset output (avoid exposing internal code internals). */
export interface AssetSummary {
  id: string;
  name: string;
  full_asset_code: string;
  base_asset_code: string;
  quantity: number;
  status_id: string | null;
  location_id: string | null;
  employee_id: string | null;
  purchase_price: string;
  is_active: boolean;
}

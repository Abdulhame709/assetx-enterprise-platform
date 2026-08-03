/**
 * Dashboard/Reporting entities — read-only analytics DTOs.
 * Reference: FRS FR-DSH-* · AAB §13.9 (dashboard metrics)
 */

export interface AssetDashboard {
  total_assets: number;
  active_assets: number;
  inactive_assets: number;   // disposed/retired (is_active=false)
  under_maintenance: number;
  retired: number;
  total_value: number;       // SUM(purchase_price * quantity)
  status_distribution: { name: string; count: number }[];
}

export interface MovementAnalytics {
  total_movements: number;
  pending: number;
  approved: number;
  rejected: number;
  by_type: { movement_type: string; count: number }[];
  top_locations: { name: string; count: number }[];
  top_departments: { department: string; count: number }[];
}

export interface InventoryAnalytics {
  completion: number;         // % inventoried
  match_rate: number;         // % matched of inventoried
  inventoried: number;
  matched: number;
  missing: number;
  surplus: number;
  deficit: number;
  transferred: number;
  not_inventoried: number;
  expected: number;
  last_cycle: { id: string; year: number; status: string } | null;
}

export interface AssetAgingItem {
  id: string;
  name: string;
  full_asset_code: string;
  purchase_date: string | null;
  purchase_price: string;
  depreciation_rate: string | null;
  useful_life: number | null;
  age_years: number | null;
  book_value: string | null;   // computed: price - (price * rate * age)
  status_name: string | null;
}

export interface AssetAging {
  items: AssetAgingItem[];
  total_assets: number;
  avg_age: number;
  high_value: number;
  near_replacement: number;   // age >= 80% of useful life
}

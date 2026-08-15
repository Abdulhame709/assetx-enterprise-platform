/**
 * Asset Experience types (Phase P2). Mirrors the backend asset/analytics/
 * lifecycle/movement/audit contracts consumed by the Asset UI.
 */

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
  /** presentation-only human-readable names (from the mapping layer) */
  _categoryName?: string;
  _locationName?: string;
  _employeeName?: string;
  _statusName?: string;
}

export interface AssetDetail extends AssetSummary {
  description: string | null;
  category_id: string | null;
  model_id: string | null;
  serial_number: string | null;
  barcode: string | null;
  purchase_date: string | null;
  depreciation_rate: string | null;
  useful_life: number | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Read-only, live calculation returned by GET /assets/:id/depreciation. */
export interface AssetDepreciation {
  asset_id: string;
  purchase_price: number;
  purchase_date: string;
  depreciation_rate: number;
  useful_life: number | null;
  yearsOwned: number;
  bookValue: number;
  depreciationPercentage: number;
  ageYears: number;
  ageMonths: number;
}

export interface AssetQuery {
  q?: string;
  category_id?: string;
  location_id?: string;
  status_id?: string;
  employee_id?: string;
  page?: number;
  limit?: number;
}

export interface PagedAssets {
  items: AssetSummary[];
  total: number;
}

export interface AnalyticsBucket {
  name: string;
  count: number;
}

export interface LifecycleDistributionBucket {
  state: string;
  count: number;
}

export interface AssetAnalyticsSummary {
  total_assets: number;
  active_assets: number;
  assigned_assets: number;
  maintenance_assets: number;
  disposed_assets: number;
  archived_assets: number;
  by_category: AnalyticsBucket[];
  by_location: AnalyticsBucket[];
  lifecycle_distribution: LifecycleDistributionBucket[];
}

export interface LifecycleState {
  assetId: string;
  state: string;
  timestamp: string;
}

export interface LifecycleTransitionRule {
  from: string;
  to: string;
  reason?: string;
}

export interface LifecycleTransitions {
  assetId: string;
  state: string;
  allowedTransitions: LifecycleTransitionRule[];
}

export type MovementType = 'transfer' | 'assignment' | 'return' | 'maintenance_return' | 'disposal' | 'retirement';
export type MovementStatus = 'pending' | 'approved' | 'rejected';

export interface AssetMovement {
  id: string;
  asset_id: string;
  movement_type: MovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_employee_id: string | null;
  to_employee_id: string | null;
  reason: string | null;
  status: MovementStatus;
  performed_by: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  action_type: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

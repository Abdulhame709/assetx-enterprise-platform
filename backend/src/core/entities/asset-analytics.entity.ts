/**
 * Asset Analytics summary entity — read model for the Asset Dashboard (Phase P2).
 * Presentation-only DTOs; computed from existing asset data (no schema change).
 * Counts mirror the lifecycle derivation: disposed/archived by inactive state +
 * movement type; assigned by custodian; maintenance via latest approved movement.
 */
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

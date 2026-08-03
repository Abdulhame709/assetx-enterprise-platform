/**
 * Reporting port — read-only analytics data access.
 * Reference: AAB §13.9 · FRS FR-DSH-* / FR-RPT-*
 */
import {
  AssetDashboard,
  MovementAnalytics,
  InventoryAnalytics,
  AssetAging,
} from '../entities/dashboard.entity';

export interface ReportingPort {
  getAssetDashboard(tenantId: string): Promise<AssetDashboard>;
  getMovementAnalytics(tenantId: string): Promise<MovementAnalytics>;
  getInventoryAnalytics(tenantId: string): Promise<InventoryAnalytics>;
  getAssetAging(tenantId: string): Promise<AssetAging>;
}

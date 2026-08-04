/**
 * AssetAnalyticsService — read-only analytics summary for the Asset Dashboard
 * (Phase P2). Computes KPI counts and distributions (by category, location,
 * lifecycle) from existing asset data. Does NOT modify ReportingService,
 * AssetService or any business service; uses the pure L1 deriveLifecycleState
 * and read-only DB queries. No schema change.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { DATABASE_PORT } from '../core/ports/tokens';
import { MovementType } from '../core/entities/movement.entity';
import { deriveLifecycleState } from './lifecycle-state-machine.service';
import { AssetAnalyticsSummary } from '../core/entities/asset-analytics.entity';

interface AssetRow {
  is_active: boolean;
  employee_id: string | null;
  category_name: string | null;
  location_name: string | null;
  latest_movement_type: MovementType | null;
}

@Injectable()
export class AssetAnalyticsService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /** Compute the dashboard summary for a tenant (read-only). */
  async summary(tenantId: string): Promise<AssetAnalyticsSummary> {
    await this.db.setTenant(tenantId);

    const { rows } = await this.db.query<AssetRow>(
      `SELECT
          a.is_active,
          a.employee_id,
          c.name AS category_name,
          l.name AS location_name,
          (SELECT mv.movement_type FROM asset_movements mv
             WHERE mv.asset_id = a.id AND mv.tenant_id = a.tenant_id AND mv.status = 'approved'
             ORDER BY mv.created_at DESC LIMIT 1) AS latest_movement_type
       FROM assets a
       LEFT JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN locations l ON l.id = a.location_id
       WHERE a.tenant_id = $1`,
      [tenantId],
    );

    let active = 0;
    let assigned = 0;
    let maintenance = 0;
    let disposed = 0;
    let archived = 0;

    const byCategory = new Map<string, number>();
    const byLocation = new Map<string, number>();
    const lifecycleDist = new Map<string, number>();

    for (const r of rows) {
      if (r.is_active) active++;
      if (r.is_active && r.employee_id) assigned++;

      const state = deriveLifecycleState({
        isActive: r.is_active,
        employeeId: r.employee_id,
        latestMovementType: r.latest_movement_type,
      });

      if (state === 'in_maintenance') maintenance++;
      if (state === 'disposed') disposed++;
      if (state === 'archived') archived++;

      lifecycleDist.set(state, (lifecycleDist.get(state) ?? 0) + 1);

      const cat = r.category_name ?? 'Uncategorized';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
      const loc = r.location_name ?? 'Unassigned';
      byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
    }

    return {
      total_assets: rows.length,
      active_assets: active,
      assigned_assets: assigned,
      maintenance_assets: maintenance,
      disposed_assets: disposed,
      archived_assets: archived,
      by_category: this.toBucket(byCategory),
      by_location: this.toBucket(byLocation),
      lifecycle_distribution: Array.from(lifecycleDist.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private toBucket(map: Map<string, number>): { name: string; count: number }[] {
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

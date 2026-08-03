/**
 * ReportingRepository — read-only analytics queries.
 * Reference: AAB §13.9 · Data Dictionary · v_inventory_result
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import {
  AssetDashboard,
  MovementAnalytics,
  InventoryAnalytics,
  AssetAging,
  AssetAgingItem,
} from '../../core/entities/dashboard.entity';
import { ReportingPort } from '../../core/ports/reporting.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class ReportingRepository implements ReportingPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async getAssetDashboard(tenantId: string): Promise<AssetDashboard> {
    const { rows } = await this.db.query<any>(
      `SELECT
         count(*) AS total_assets,
         count(*) FILTER (WHERE is_active = true) AS active_assets,
         count(*) FILTER (WHERE is_active = false) AS inactive_assets,
         COALESCE(SUM(purchase_price * quantity), 0) AS total_value
       FROM assets WHERE tenant_id = $1`,
      [tenantId],
    );
    const base = rows[0];

    const { rows: statusRows } = await this.db.query<{ name: string; count: number }>(
      `SELECT COALESCE(s.name, 'Unknown') AS name, count(a.id) AS count
       FROM assets a LEFT JOIN statuses s ON s.id = a.status_id
       WHERE a.tenant_id = $1 AND a.is_active = true
       GROUP BY s.name ORDER BY count DESC`,
      [tenantId],
    );

    const { rows: maint } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets a
       JOIN statuses s ON s.id = a.status_id
       WHERE a.tenant_id = $1 AND a.is_active = true AND (s.name ILIKE '%maintenance%')`,
      [tenantId],
    );
    const { rows: retired } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets a
       JOIN statuses s ON s.id = a.status_id
       WHERE a.tenant_id = $1 AND (s.name ILIKE '%retired%' OR s.name ILIKE '%damaged%')`,
      [tenantId],
    );

    return {
      total_assets: Number(base.total_assets),
      active_assets: Number(base.active_assets),
      inactive_assets: Number(base.inactive_assets),
      under_maintenance: Number(maint[0]?.c ?? 0),
      retired: Number(retired[0]?.c ?? 0),
      total_value: Number(base.total_value),
      status_distribution: statusRows,
    };
  }

  async getMovementAnalytics(tenantId: string): Promise<MovementAnalytics> {
    const { rows } = await this.db.query<any>(
      `SELECT
         count(*) AS total,
         count(*) FILTER (WHERE status = 'pending') AS pending,
         count(*) FILTER (WHERE status = 'approved') AS approved,
         count(*) FILTER (WHERE status = 'rejected') AS rejected
       FROM asset_movements WHERE tenant_id = $1`,
      [tenantId],
    );
    const base = rows[0];
    const { rows: byType } = await this.db.query<{ movement_type: string; count: number }>(
      `SELECT movement_type, count(*) AS count FROM asset_movements
       WHERE tenant_id = $1 GROUP BY movement_type ORDER BY count DESC`,
      [tenantId],
    );
    const { rows: topLocations } = await this.db.query<{ name: string; count: number }>(
      `SELECT COALESCE(l.name, 'Unknown') AS name, count(m.id) AS count
       FROM asset_movements m LEFT JOIN locations l ON l.id = m.to_location_id
       WHERE m.tenant_id = $1 GROUP BY l.name ORDER BY count DESC LIMIT 5`,
      [tenantId],
    );
    const { rows: topDepts } = await this.db.query<{ department: string; count: number }>(
      `SELECT COALESCE(e.department, 'Unknown') AS department, count(m.id) AS count
       FROM asset_movements m LEFT JOIN employees e ON e.id = m.to_employee_id
       WHERE m.tenant_id = $1 GROUP BY e.department ORDER BY count DESC LIMIT 5`,
      [tenantId],
    );

    return {
      total_movements: Number(base.total),
      pending: Number(base.pending),
      approved: Number(base.approved),
      rejected: Number(base.rejected),
      by_type: byType,
      top_locations: topLocations,
      top_departments: topDepts,
    };
  }

  async getInventoryAnalytics(tenantId: string): Promise<InventoryAnalytics> {
    const { rows } = await this.db.query<any>(
      `SELECT
         count(*) AS expected,
         count(*) FILTER (WHERE result <> 'not_inventoried') AS inventoried,
         count(*) FILTER (WHERE result = 'matched') AS matched,
         count(*) FILTER (WHERE result = 'missing') AS missing,
         count(*) FILTER (WHERE result = 'surplus') AS surplus,
         count(*) FILTER (WHERE result = 'deficit') AS deficit,
         count(*) FILTER (WHERE result = 'transferred') AS transferred,
         count(*) FILTER (WHERE result = 'not_inventoried') AS not_inventoried
       FROM v_inventory_result WHERE cycle_id IN (
         SELECT id FROM inventory_cycles WHERE tenant_id = $1
       )`,
      [tenantId],
    );
    const b = rows[0] ?? {};
    const expected = Number(b.expected ?? 0);
    const inventoried = Number(b.inventoried ?? 0);
    const { rows: lastCycle } = await this.db.query<{ id: string; year: number; status: string }>(
      `SELECT id, year, status FROM inventory_cycles WHERE tenant_id = $1 ORDER BY year DESC LIMIT 1`,
      [tenantId],
    );

    return {
      expected,
      inventoried,
      matched: Number(b.matched ?? 0),
      missing: Number(b.missing ?? 0),
      surplus: Number(b.surplus ?? 0),
      deficit: Number(b.deficit ?? 0),
      transferred: Number(b.transferred ?? 0),
      not_inventoried: Number(b.not_inventoried ?? 0),
      completion: expected ? Math.round((100 * inventoried) / expected) : 0,
      match_rate: inventoried ? Math.round((100 * Number(b.matched ?? 0)) / inventoried) : 0,
      last_cycle: lastCycle[0] ?? null,
    };
  }

  async getAssetAging(tenantId: string): Promise<AssetAging> {
    const { rows } = await this.db.query<AssetAgingItem>(
      `SELECT
         a.id, a.name, a.full_asset_code, a.purchase_date,
         a.purchase_price, a.depreciation_rate, a.useful_life,
         round(EXTRACT(EPOCH FROM (now() - a.purchase_date)) / 31557600, 2) AS age_years,
         s.name AS status_name
       FROM assets a LEFT JOIN statuses s ON s.id = a.status_id
       WHERE a.tenant_id = $1 AND a.is_active = true AND a.purchase_date IS NOT NULL
       ORDER BY a.purchase_date ASC`,
      [tenantId],
    );

    const items = rows.map((r) => {
      const price = Number(r.purchase_price ?? 0);
      const rate = Number(r.depreciation_rate ?? 0) / 100;
      const age = Number(r.age_years ?? 0);
      const book = price > 0 ? Math.max(0, price - price * rate * age) : 0;
      return { ...r, book_value: book.toFixed(2) };
    });

    const avgAge = items.length ? items.reduce((s, i) => s + Number(i.age_years ?? 0), 0) / items.length : 0;
    const highValue = items.filter((i) => Number(i.purchase_price ?? 0) >= 10000).length;
    const nearReplacement = items.filter((i) => {
      const life = Number(i.useful_life ?? 0);
      return life > 0 && Number(i.age_years ?? 0) >= life * 0.8;
    }).length;

    return {
      items,
      total_assets: items.length,
      avg_age: Math.round(avgAge * 100) / 100,
      high_value: highValue,
      near_replacement: nearReplacement,
    };
  }
}

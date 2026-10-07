/**
 * ResultRepository — infrastructure implementation of ResultPort.
 * Uses v_inventory_result view (ADL-006: computed result, reference only).
 * Reference: db/migrations/001_init.sql (v_inventory_result)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { InventoryRecordResult } from '../../core/entities/inventory.entity';
import { ResultPort, InventorySummaryLike } from '../../core/ports/inventory.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class ResultRepository implements ResultPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async getSummary(cycleId: string, tenantId: string): Promise<InventorySummaryLike> {
    const { rows } = await this.db.query<InventorySummaryLike>(
      `SELECT
         $1::uuid AS cycle_id,
         (SELECT status FROM inventory_cycles WHERE id = $1) AS status,
         count(*) AS expected_assets,
         count(*) FILTER (WHERE result <> 'not_inventoried') AS inventoried,
         count(*) FILTER (WHERE result = 'matched')   AS matched,
         count(*) FILTER (WHERE result = 'missing')   AS missing,
         count(*) FILTER (WHERE result = 'deficit')   AS deficit,
         count(*) FILTER (WHERE result = 'surplus')   AS surplus,
         count(*) FILTER (WHERE result = 'transferred') AS transferred,
         count(*) FILTER (WHERE result = 'not_inventoried') AS not_inventoried,
         (count(*) FILTER (WHERE result = 'matched') - count(*)) AS variance,
         CASE WHEN count(*) > 0
           THEN round(100.0 * count(*) FILTER (WHERE result <> 'not_inventoried') / count(*), 2)
           ELSE 0 END AS completion
       FROM v_inventory_result
       WHERE cycle_id = $1`,
      [cycleId],
    );
    return rows[0];
  }

  async getResults(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]> {
    // The v_inventory_result view exposes the computed result but only a subset
    // of columns, so status ids are read from inventory_records directly and the
    // human-readable status names + asset/location/employee names are joined
    // for reports/exports (the inventory report needs the actual names, not IDs).
    const { rows } = await this.db.query<InventoryRecordResult>(
      `SELECT
         ir.id, ir.tenant_id, ir.cycle_id, ir.asset_id,
         ir.expected_location_id, ir.expected_quantity, ir.expected_status_id,
         ir.expected_employee_id, ir.actual_location_id, ir.actual_quantity,
         ir.actual_status_id, ir.actual_employee_id,
         ir.inventory_date, ir.inventory_by, ir.is_verified, ir.verified_by,
         ir.verified_date, ir.notes, ir.created_at, ir.updated_at,
         vw.result,
         es.name AS expected_status_name,
         ast.name AS actual_status_name,
         a.name AS asset_name,
         a.full_asset_code AS asset_code,
         el.name AS expected_location_name,
         el.full_path AS expected_location_path,
         al.name AS actual_location_name,
         al.full_path AS actual_location_path,
         ee.name AS expected_employee_name,
         ae.name AS actual_employee_name
       FROM inventory_records ir
       JOIN v_inventory_result vw ON vw.id = ir.id
       JOIN assets a ON a.id = ir.asset_id AND a.tenant_id = ir.tenant_id
       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id
       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id
       LEFT JOIN locations el ON el.id = ir.expected_location_id AND el.tenant_id = ir.tenant_id
       LEFT JOIN locations al ON al.id = ir.actual_location_id AND al.tenant_id = ir.tenant_id
       LEFT JOIN employees ee ON ee.id = ir.expected_employee_id AND ee.tenant_id = ir.tenant_id
       LEFT JOIN employees ae ON ae.id = ir.actual_employee_id AND ae.tenant_id = ir.tenant_id
       WHERE ir.cycle_id = $1
       ORDER BY ir.id`,
      [cycleId],
    );
    return rows;
  }
}

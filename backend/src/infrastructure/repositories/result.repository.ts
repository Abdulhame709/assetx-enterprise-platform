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
    const { rows } = await this.db.query<InventoryRecordResult>(
      `SELECT * FROM v_inventory_result WHERE cycle_id = $1 ORDER BY id`,
      [cycleId],
    );
    return rows;
  }
}

/**
 * RecordRepository — infrastructure implementation of RecordPort.
 * Reference: Data Dictionary (DOC-24) TB-RECORD · BR-INV-001/002/003
 * Result is COMPUTED via v_inventory_result (ADL-006), not stored.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import {
  InventoryRecord,
  InventoryRecordResult,
  CycleScope,
} from '../../core/entities/inventory.entity';
import { RecordPort, RecordInput } from '../../core/ports/inventory.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

const RESULT_SELECT = `
  SELECT ir.*,
         CASE
           WHEN ir.actual_quantity IS NULL THEN 'not_inventoried'
           WHEN ir.actual_quantity = 0 THEN 'missing'
           WHEN ir.actual_quantity < ir.expected_quantity THEN 'deficit'
           WHEN ir.actual_quantity > ir.expected_quantity THEN 'surplus'
           WHEN ir.actual_location_id IS DISTINCT FROM ir.expected_location_id THEN 'transferred'
           ELSE 'matched'
         END AS result
  FROM inventory_records ir`;

@Injectable()
export class RecordRepository implements RecordPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /** Snapshot active assets into records (BR-INV-001), optionally scoped by location/category. */
  async createSnapshot(tenantId: string, cycleId: string, scope: CycleScope): Promise<number> {
    let where = `a.tenant_id = $1 AND a.is_active = true`;
    const params: unknown[] = [tenantId, cycleId];
    if (scope?.location_id) {
      params.push(scope.location_id);
      where += ` AND a.location_id IN (
        SELECT id FROM locations WHERE tenant_id = $1 AND path <@ (SELECT path FROM locations WHERE id = $${params.length})
      )`;
    }
    if (scope?.category_id) {
      params.push(scope.category_id);
      where += ` AND a.category_id = $${params.length}`;
    }
    const { rows } = await this.db.query<{ count: number }>(
      `WITH assets_to_snapshot AS (
         SELECT a.id, a.location_id, a.quantity, a.status_id, a.employee_id
         FROM assets a WHERE ${where}
       ),
       inserted AS (
         INSERT INTO inventory_records
           (tenant_id, cycle_id, asset_id,
            expected_location_id, expected_quantity, expected_status_id, expected_employee_id)
         SELECT $1, $2, a.id, a.location_id, a.quantity, a.status_id, a.employee_id
         FROM assets_to_snapshot a
         ON CONFLICT (cycle_id, asset_id) DO NOTHING
         RETURNING 1
       )
       SELECT count(*) AS count FROM inserted`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async updateRecord(recordId: string, tenantId: string, input: RecordInput, userId: string): Promise<InventoryRecord | null> {
    const { rows } = await this.db.query<InventoryRecord>(
      `UPDATE inventory_records SET
         actual_location_id = COALESCE($2, expected_location_id),
         actual_quantity    = COALESCE($3, actual_quantity),
         actual_status_id   = COALESCE($4, actual_status_id),
         actual_employee_id = COALESCE($5, actual_employee_id),
         notes              = COALESCE($6, notes),
         inventory_date     = now()::date,
         inventory_by       = $7::uuid,
         is_verified        = false,
         updated_at         = now()
       WHERE id = $1 AND tenant_id = $8
       RETURNING *`,
      [recordId, input.actual_location_id ?? null, input.actual_quantity ?? null,
       input.actual_status_id ?? null, input.actual_employee_id ?? null,
       input.notes ?? null, userId, tenantId],
    );
    return rows[0] ?? null;
  }

  async listByCycle(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]> {
    const { rows } = await this.db.query<InventoryRecordResult>(
      `${RESULT_SELECT} WHERE ir.cycle_id = $1 AND ir.tenant_id = $2 ORDER BY ir.created_at`,
      [cycleId, tenantId],
    );
    return rows;
  }

  async findById(id: string, tenantId: string): Promise<InventoryRecord | null> {
    const { rows } = await this.db.query<InventoryRecord>(
      `SELECT * FROM inventory_records WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async setVerified(recordId: string, tenantId: string, verified: boolean, userId: string): Promise<InventoryRecord | null> {
    const { rows } = await this.db.query<InventoryRecord>(
      `UPDATE inventory_records SET
         is_verified = $3,
         verified_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
         verified_date = CASE WHEN $3 THEN now() ELSE NULL END,
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [recordId, tenantId, verified, userId],
    );
    return rows[0] ?? null;
  }

  async countInventoried(cycleId: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM inventory_records
       WHERE cycle_id = $1 AND tenant_id = $2 AND actual_quantity IS NOT NULL`,
      [cycleId, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }
}

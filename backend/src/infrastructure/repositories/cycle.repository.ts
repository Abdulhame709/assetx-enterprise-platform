/**
 * CycleRepository — infrastructure implementation of CyclePort.
 * Reference: Data Dictionary (DOC-24) TB-CYCLE · BR-INV-001/002 · ADL-008 (per-tenant year)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { InventoryCycle } from '../../core/entities/inventory.entity';
import { CyclePort } from '../../core/ports/inventory.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class CycleRepository implements CyclePort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(tenantId: string, year: number): Promise<InventoryCycle> {
    const { rows } = await this.db.query<InventoryCycle>(
      `INSERT INTO inventory_cycles (tenant_id, year, status)
       VALUES ($1, $2, 'new') RETURNING *`,
      [tenantId, year],
    );
    return rows[0];
  }

  async findById(id: string, tenantId: string): Promise<InventoryCycle | null> {
    const { rows } = await this.db.query<InventoryCycle>(
      `SELECT * FROM inventory_cycles WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<InventoryCycle[]> {
    const { rows } = await this.db.query<InventoryCycle>(
      `SELECT * FROM inventory_cycles WHERE tenant_id = $1 ORDER BY year DESC`,
      [tenantId],
    );
    return rows;
  }

  async updateStatus(id: string, tenantId: string, status: InventoryCycle['status'], setEnd = false): Promise<InventoryCycle | null> {
    const { rows } = await this.db.query<InventoryCycle>(
      `UPDATE inventory_cycles SET
         status = $3::cycle_status,
         start_date = CASE WHEN $4 THEN COALESCE(start_date, now()::date) ELSE start_date END,
         end_date = CASE WHEN $3::cycle_status = 'closed' THEN now()::date ELSE end_date END,
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, status, setEnd],
    );
    return rows[0] ?? null;
  }

  async existsYear(tenantId: string, year: number, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM inventory_cycles
       WHERE tenant_id = $1 AND year = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, year, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }
}

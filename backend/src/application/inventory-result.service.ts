/**
 * InventoryResultService — calculation engine.
 * Compares snapshot vs actual using the v_inventory_result view (ADL-006).
 * Does NOT duplicate calculation logic — it consumes the DB view.
 * Reference: db/migrations v_inventory_result · BR-INV-*
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { CyclePort, ResultPort } from '../core/ports/inventory.port';
import { InventoryRecordResult, InventorySummary } from '../core/entities/inventory.entity';
import { CYCLE_PORT, DATABASE_PORT, RESULT_PORT } from '../core/ports/tokens';
import { assessLocationAnomaly } from './asset-algorithms';

export interface MobileInventorySnapshotRecord {
  record_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  expected_location_id: string | null;
  expected_location: string | null;
  expected_location_path: string | null;
  actual_location_id: string | null;
  actual_location: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  result: InventoryRecordResult['result'];
  inventory_date: string | null;
  notes: string | null;
  is_verified: boolean;
  updated_at: Date;
}

@Injectable()
export class InventoryResultService {
  constructor(
    @Inject(CYCLE_PORT) private readonly cycles: CyclePort,
    @Inject(RESULT_PORT) private readonly results: ResultPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  /** Summary for a cycle (expected/found/missing/extra/variance/completion). */
  async getSummary(cycleId: string, tenantId: string): Promise<InventorySummary> {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    const s = await this.results.getSummary(cycleId, tenantId);
    return {
      cycle_id: cycleId,
      status: cycle.status,
      expected_assets: Number(s.expected_assets),
      inventoried: Number(s.inventoried),
      found: Number(s.matched),
      missing: Number(s.missing),
      extra: Number(s.surplus),
      deficit: Number(s.deficit),
      transferred: Number(s.transferred),
      not_inventoried: Number(s.not_inventoried),
      variance: Number(s.variance),
      completion: Number(s.completion),
    };
  }

  /** Summary for the most recent cycle, or null if none exists. */
  async getSummaryForLatest(tenantId: string): Promise<InventorySummary | null> {
    await this.db.setTenant(tenantId);
    const cycles = await this.cycles.list(tenantId);
    if (cycles.length === 0) return null;
    // list is ordered by year DESC (latest first)
    const latest = cycles[0];
    return this.getSummary(latest.id, tenantId);
  }

  /** Per-record computed results (found/missing/transferred/...). */
  async getResults(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]> {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    return this.results.getResults(cycleId, tenantId);
  }

  /**
   * Field-mobile download payload. The snapshot remains scoped to the selected
   * cycle and tenant; it includes only operational fields needed for offline
   * counting, never credentials or unrelated tenant data.
   */
  async getMobileSnapshot(cycleId: string, tenantId: string) {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');

    const { rows } = await this.db.query<MobileInventorySnapshotRecord>(
      `SELECT
         ir.id AS record_id,
         ir.asset_id,
         a.full_asset_code AS asset_code,
         a.name AS asset_name,
         ir.expected_location_id,
         expected_location.name AS expected_location,
         expected_location.full_path AS expected_location_path,
         ir.actual_location_id,
         actual_location.name AS actual_location,
         ir.expected_quantity,
         ir.actual_quantity,
         result.result,
         ir.inventory_date,
         ir.notes,
         ir.is_verified,
         ir.updated_at
       FROM inventory_records ir
       JOIN assets a ON a.id = ir.asset_id AND a.tenant_id = ir.tenant_id
       LEFT JOIN locations expected_location ON expected_location.id = ir.expected_location_id
       LEFT JOIN locations actual_location ON actual_location.id = ir.actual_location_id
       JOIN v_inventory_result result ON result.id = ir.id
       WHERE ir.tenant_id = $1 AND ir.cycle_id = $2
       ORDER BY a.name ASC, a.full_asset_code ASC`,
      [tenantId, cycleId],
    );

    return { cycle, records: rows };
  }

  /**
   * L1 location assistant output. This endpoint is read-only: it exposes
   * explainable discrepancy suggestions for a reviewer, never changes asset
   * data and never creates a transfer movement.
   */
  async getLocationSuggestions(cycleId: string, tenantId: string) {
    const snapshot = await this.getMobileSnapshot(cycleId, tenantId);
    const suggestions = snapshot.records
      .map((record) => {
        const assessment = assessLocationAnomaly({
          expectedLocationId: record.expected_location_id,
          actualLocationId: record.actual_location_id,
          expectedQuantity: record.expected_quantity,
          actualQuantity: record.actual_quantity,
        });
        return assessment.isAnomaly ? {
          record_id: record.record_id,
          asset_id: record.asset_id,
          asset_code: record.asset_code,
          asset_name: record.asset_name,
          expected_location_id: record.expected_location_id,
          expected_location: record.expected_location,
          actual_location_id: record.actual_location_id,
          actual_location: record.actual_location,
          expected_quantity: record.expected_quantity,
          actual_quantity: record.actual_quantity,
          ...assessment,
        } : null;
      })
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => suggestion !== null);
    return { cycle: snapshot.cycle, suggestions };
  }
}

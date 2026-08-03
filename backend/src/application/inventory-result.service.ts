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

  /** Per-record computed results (found/missing/transferred/...). */
  async getResults(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]> {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    return this.results.getResults(cycleId, tenantId);
  }
}

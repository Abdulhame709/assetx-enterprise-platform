/**
 * RecordService — application use cases for inventory records (ENT-RECORD).
 * Reference: FRS FR-INV and FR-FLD | Business Rules BR-INV-002/003 | ADL-006
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { CyclePort, RecordPort, RecordInput } from '../core/ports/inventory.port';
import { InventoryRecord, InventoryRecordResult, InventoryCycle } from '../core/entities/inventory.entity';
import { CYCLE_PORT, DATABASE_PORT, RECORD_PORT } from '../core/ports/tokens';

@Injectable()
export class RecordService {
  constructor(
    @Inject(CYCLE_PORT) private readonly cycles: CyclePort,
    @Inject(RECORD_PORT) private readonly records: RecordPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  private async assertWritable(cycle: InventoryCycle): Promise<void> {
    if (cycle.status === 'closed') throw new Error('CYCLE_CLOSED'); // BR-INV-002
  }

  /** Create/inventory a record's actual result. Guards closed cycle. */
  async record(cycleId: string, tenantId: string, assetId: string, input: RecordInput, userId: string): Promise<InventoryRecord> {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    await this.assertWritable(cycle);

    // find the snapshot record for this asset (existing record), else ensure one exists
    const list = await this.records.listByCycle(cycleId, tenantId);
    const rec = list.find((r) => r.asset_id === assetId);
    if (!rec) throw new Error('ASSET_NOT_IN_CYCLE');
    // A first count that omits actual_location keeps the expected location,
    // while an explicit null remains a deliberate clear operation for recounts.
    const normalizedInput = Object.prototype.hasOwnProperty.call(input, 'actual_location_id')
      ? input
      : { ...input, actual_location_id: rec.expected_location_id };
    const updated = await this.records.updateRecord(rec.id, tenantId, normalizedInput, userId);
    if (!updated) throw new Error('RECORD_NOT_FOUND');
    return updated;
  }

  /**
   * Apply one offline mutation exactly once.
   * - A mutation_id that was already applied returns its original result
   *   (a retry after a lost response is not a conflict and is not re-applied).
   * - The client must state which server version it edited (base_updated_at);
   *   the mutation is applied only while the record is still at that version.
   */
  async sync(
    cycleId: string,
    recordId: string,
    tenantId: string,
    assetId: string,
    mutationId: string,
    baseUpdatedAt: string | null | undefined,
    input: RecordInput,
    userId: string,
  ): Promise<{ updated_at: string; replayed: boolean }> {
    if (typeof mutationId !== 'string' || mutationId.length < 1 || mutationId.length > 128) {
      throw new Error('MUTATION_ID_INVALID');
    }
    await this.db.setTenant(tenantId);

    const prior = await this.db.query<{ record_id: string; cycle_id: string; applied_updated_at: Date | string }>(
      `SELECT record_id, cycle_id, applied_updated_at FROM sync_mutations
       WHERE tenant_id = $1 AND mutation_id = $2`,
      [tenantId, mutationId],
    );
    if (prior.rows[0]) {
      // The same id must always describe the same edit.
      if (prior.rows[0].record_id !== recordId || prior.rows[0].cycle_id !== cycleId) {
        throw new Error('MUTATION_ID_REUSED');
      }
      return { updated_at: new Date(prior.rows[0].applied_updated_at).toISOString(), replayed: true };
    }

    if (!baseUpdatedAt) throw new Error('BASE_VERSION_REQUIRED');
    const baseTime = new Date(baseUpdatedAt).getTime();
    if (Number.isNaN(baseTime)) throw new Error('BASE_VERSION_INVALID');

    const rec = await this.records.findById(recordId, tenantId);
    if (!rec) throw new Error('RECORD_NOT_FOUND');
    if (rec.cycle_id !== cycleId) throw new Error('CYCLE_RECORD_MISMATCH');
    if (rec.asset_id !== assetId) throw new Error('ASSET_RECORD_MISMATCH');
    if (new Date(rec.updated_at).getTime() !== baseTime) throw new Error('SYNC_CONFLICT');
    const cycle = await this.cycles.findById(rec.cycle_id, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    await this.assertWritable(cycle);
    const updated = await this.records.updateRecord(recordId, tenantId, input, userId);
    if (!updated) throw new Error('RECORD_NOT_FOUND');

    await this.db.query(
      `INSERT INTO sync_mutations (tenant_id, mutation_id, cycle_id, record_id, user_id, applied_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, mutation_id) DO NOTHING`,
      [tenantId, mutationId, cycleId, recordId, userId, updated.updated_at],
    );
    return { updated_at: new Date(updated.updated_at).toISOString(), replayed: false };
  }

  /** Get all records of a cycle with computed results. */
  async listByCycle(cycleId: string, tenantId: string): Promise<InventoryRecordResult[]> {
    await this.db.setTenant(tenantId);
    const cycle = await this.cycles.findById(cycleId, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    return this.records.listByCycle(cycleId, tenantId);
  }

  /** Update a record by its own id (field-level). Guards closed cycle. */
  async update(recordId: string, tenantId: string, input: RecordInput, userId: string): Promise<InventoryRecord> {
    await this.db.setTenant(tenantId);
    const rec = await this.records.findById(recordId, tenantId);
    if (!rec) throw new Error('RECORD_NOT_FOUND');
    const cycle = await this.cycles.findById(rec.cycle_id, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    await this.assertWritable(cycle);
    const updated = await this.records.updateRecord(recordId, tenantId, input, userId);
    if (!updated) throw new Error('RECORD_NOT_FOUND');
    return updated;
  }

  /** Verify/unverify a record (BR-INV-003). Closed cycle protection. */
  async verify(recordId: string, tenantId: string, verified: boolean, userId: string): Promise<InventoryRecord> {
    await this.db.setTenant(tenantId);
    const rec = await this.records.findById(recordId, tenantId);
    if (!rec) throw new Error('RECORD_NOT_FOUND');
    const cycle = await this.cycles.findById(rec.cycle_id, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    await this.assertWritable(cycle);
    if (verified && rec.actual_quantity === null) throw new Error('CANNOT_VERIFY_UNINVENTORIED'); // BR-INV-003
    const updated = await this.records.setVerified(recordId, tenantId, verified, userId);
    if (!updated) throw new Error('RECORD_NOT_FOUND');
    return updated;
  }
}

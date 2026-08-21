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

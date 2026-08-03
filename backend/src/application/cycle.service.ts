/**
 * CycleService — application use cases for inventory cycles (ENT-CYCLE).
 * Reference: FRS FR-INV-* · Business Rules BR-INV-001/002 · ADL-008
 * State machine: new (Draft) → in_progress (Running) → closed (Closed/Completed).
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { CyclePort, RecordPort } from '../core/ports/inventory.port';
import { InventoryCycle, CycleStatus, CycleScope } from '../core/entities/inventory.entity';
import { CYCLE_PORT, DATABASE_PORT, RECORD_PORT } from '../core/ports/tokens';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';

const ALLOWED_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  new: ['in_progress'],
  in_progress: ['closed'],
  closed: [], // terminal — BR-INV-002
};

@Injectable()
export class CycleService {
  constructor(
    @Inject(CYCLE_PORT) private readonly cycles: CyclePort,
    @Inject(RECORD_PORT) private readonly records: RecordPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
  ) {}

  /** Create a cycle and snapshot active assets (BR-INV-001). */
  async create(tenantId: string, year: number, scope: CycleScope): Promise<{ cycle: InventoryCycle; snapshotCount: number }> {
    await this.db.setTenant(tenantId);
    if (!year || year < 2000 || year > 2100) throw new Error('INVALID_YEAR');
    if (await this.cycles.existsYear(tenantId, year)) throw new Error('CYCLE_YEAR_EXISTS');
    const cycle = await this.cycles.create(tenantId, year);
    const snapshotCount = await this.records.createSnapshot(tenantId, cycle.id, scope);
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.INVENTORY_CREATED, entity: 'inventory', entityId: cycle.id,
      metadata: { year, snapshotCount },
    }).catch(() => undefined);
    return { cycle, snapshotCount };
  }

  async getById(id: string, tenantId: string): Promise<InventoryCycle | null> {
    await this.db.setTenant(tenantId);
    return this.cycles.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<InventoryCycle[]> {
    await this.db.setTenant(tenantId);
    return this.cycles.list(tenantId);
  }

  /** Start (new → in_progress). */
  async start(id: string, tenantId: string): Promise<InventoryCycle> {
    await this.db.setTenant(tenantId);
    return this.transition(id, tenantId, 'in_progress');
  }

  /** Close (in_progress → closed). Terminal — BR-INV-002. */
  async close(id: string, tenantId: string): Promise<InventoryCycle> {
    await this.db.setTenant(tenantId);
    return this.transition(id, tenantId, 'closed');
  }

  private async transition(id: string, tenantId: string, to: CycleStatus): Promise<InventoryCycle> {
    const cycle = await this.cycles.findById(id, tenantId);
    if (!cycle) throw new Error('CYCLE_NOT_FOUND');
    const allowed = ALLOWED_TRANSITIONS[cycle.status];
    if (!allowed.includes(to)) throw new Error('INVALID_CYCLE_TRANSITION');
    const updated = await this.cycles.updateStatus(id, tenantId, to, true);
    if (!updated) throw new Error('CYCLE_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: to === 'in_progress' ? AUDIT_EVENTS.INVENTORY_STARTED : AUDIT_EVENTS.INVENTORY_CLOSED,
      entity: 'inventory', entityId: id,
      metadata: { from: cycle.status, to },
    }).catch(() => undefined);
    return updated;
  }
}

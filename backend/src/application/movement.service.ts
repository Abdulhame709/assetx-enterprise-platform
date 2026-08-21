/**
 * MovementService — application use cases for asset movements & lifecycle.
 * Reference: FRS FR-MOV-* · Business Rules BR-MOV-001..005 · ADR-007
 * Workflow: create (pending) → approve (apply to asset) | reject (no asset change)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { MovementPort, CreateMovementInput } from '../core/ports/movement.port';
import { AssetPort } from '../core/ports/asset.port';
import { AssetMovement, MovementType, MovementStatus } from '../core/entities/movement.entity';
import { Asset } from '../core/entities/asset.entity';
import { ASSET_PORT, DATABASE_PORT, MOVEMENT_PORT } from '../core/ports/tokens';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';
import { EVENT_BUS } from '../core/ports/tokens';

@Injectable()
export class MovementService {
  constructor(
    @Inject(MOVEMENT_PORT) private readonly movements: MovementPort,
    @Inject(ASSET_PORT) private readonly assets: AssetPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  /** Create a movement. Validates the asset/employee, then stores as pending (no asset change). */
  async create(tenantId: string, input: CreateMovementInput): Promise<AssetMovement> {
    await this.db.setTenant(tenantId);
    const raw = await this.db.query<Asset>(
      `SELECT * FROM assets WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [input.asset_id, tenantId],
    );
    const asset = raw.rows[0];
    if (!asset) throw new Error('ASSET_NOT_FOUND');
    if (!asset.is_active) throw new Error('ASSET_INACTIVE');            // prevent moving inactive
    if (input.to_employee_id) {
      const emp = await this.db.query<{ is_active: boolean }>(`SELECT is_active FROM employees WHERE id=$1 AND tenant_id=$2`, [input.to_employee_id, tenantId]);
      if (!emp.rows[0] || !emp.rows[0].is_active) throw new Error('EMPLOYEE_INACTIVE'); // assign to active employee
    }
    if (input.movement_type === 'transfer' && input.to_location_id === asset.location_id) {
      throw new Error('SAME_LOCATION');                                  // transfer to same location
    }
    if (await this.movements.hasPending('', input.asset_id, tenantId, input.movement_type)) {
      throw new Error('DUPLICATE_PENDING');                              // duplicate pending
    }

    // capture from-state (BR-MOV-001: audit history). All movements are created
    // pending and applied only on approval (BR-MOV-005 requires approval workflow).
    const created = await this.movements.create({
      tenant_id: tenantId,
      asset_id: input.asset_id,
      movement_type: input.movement_type,
      from_location_id: input.from_location_id ?? asset.location_id,
      to_location_id: input.to_location_id ?? null,
      from_employee_id: input.from_employee_id ?? asset.employee_id,
      to_employee_id: input.to_employee_id ?? null,
      from_status_id: asset.status_id ?? null,
      reason: input.reason,
      reference_number: input.reference_number,
      quantity: input.quantity,
      notes: input.notes,
      performed_by: input.performed_by,
    });
    await this.audit.log({
      tenant_id: tenantId, userId: input.performed_by ?? null,
      action: AUDIT_EVENTS.MOVEMENT_CREATED, entity: 'movement', entityId: created.id,
      metadata: { asset_id: input.asset_id, movement_type: created.movement_type },
    }).catch(() => undefined);
    // Notify: movement pending approval
    this.bus.publish({
      event: DOMAIN_EVENTS.MOVEMENT_PENDING,
      tenant_id: tenantId,
      userId: input.performed_by ?? undefined,
      entityId: created.id,
      payload: { action: created.movement_type, asset_id: input.asset_id },
    });
    return created;
  }

  /** Approve a pending movement and apply its effect to the asset. */
  async approve(id: string, tenantId: string, approverId: string): Promise<AssetMovement> {
    await this.db.setTenant(tenantId);
    const mv = await this.movements.findById(id, tenantId);
    if (!mv) throw new Error('MOVEMENT_NOT_FOUND');
    if (mv.status !== 'pending') throw new Error('MOVEMENT_NOT_PENDING');
    await this.applyToAsset(mv, tenantId);
    const updated = await this.movements.setStatus(id, tenantId, 'approved', approverId);
    if (!updated) throw new Error('MOVEMENT_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId, userId: approverId,
      action: AUDIT_EVENTS.MOVEMENT_APPROVED, entity: 'movement', entityId: id,
      metadata: { asset_id: mv.asset_id, movement_type: mv.movement_type },
    }).catch(() => undefined);
    this.bus.publish({
      event: DOMAIN_EVENTS.MOVEMENT_APPROVED,
      tenant_id: tenantId,
      entityId: id,
      payload: { asset_name: mv.asset_id, movement_type: mv.movement_type },
    });
    return updated;
  }

  /** Reject a pending movement (no asset change). */
  async reject(id: string, tenantId: string): Promise<AssetMovement> {
    await this.db.setTenant(tenantId);
    const mv = await this.movements.findById(id, tenantId);
    if (!mv) throw new Error('MOVEMENT_NOT_FOUND');
    if (mv.status !== 'pending') throw new Error('MOVEMENT_NOT_PENDING');
    const updated = await this.movements.setStatus(id, tenantId, 'rejected', null as never);
    if (!updated) throw new Error('MOVEMENT_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.MOVEMENT_REJECTED, entity: 'movement', entityId: id,
      metadata: { asset_id: mv.asset_id, movement_type: mv.movement_type },
    }).catch(() => undefined);
    this.bus.publish({
      event: DOMAIN_EVENTS.MOVEMENT_REJECTED,
      tenant_id: tenantId,
      entityId: id,
      payload: { asset_name: mv.asset_id, movement_type: mv.movement_type },
    });
    return updated;
  }

  async getById(id: string, tenantId: string): Promise<AssetMovement | null> {
    await this.db.setTenant(tenantId);
    return this.movements.findById(id, tenantId);
  }

  async listByAsset(assetId: string, tenantId: string): Promise<AssetMovement[]> {
    await this.db.setTenant(tenantId);
    return this.movements.listByAsset(assetId, tenantId);
  }

  async list(tenantId: string, filter?: { status?: MovementStatus; movement_type?: MovementType }): Promise<AssetMovement[]> {
    await this.db.setTenant(tenantId);
    return this.movements.list(tenantId, filter);
  }

  /** Dispose asset (BR-MOV-004: disposed assets cannot return to active). */
  async dispose(tenantId: string, assetId: string, performedBy: string, reason?: string): Promise<AssetMovement> {
    return this.create(tenantId, { tenant_id: tenantId, asset_id: assetId, movement_type: 'disposal', reason, performed_by: performedBy });
  }

  /** Retire asset. */
  async retire(tenantId: string, assetId: string, performedBy: string, reason?: string): Promise<AssetMovement> {
    return this.create(tenantId, { tenant_id: tenantId, asset_id: assetId, movement_type: 'retirement', reason, performed_by: performedBy });
  }

  /** Apply the movement's effect to the asset (on approval only — BR-MOV-002). */
  private async applyToAsset(mv: AssetMovement, tenantId: string): Promise<void> {
    const asset = await this.assets.findById(mv.asset_id, tenantId);
    if (!asset) throw new Error('ASSET_NOT_FOUND');

    switch (mv.movement_type) {
      case 'transfer':
        // BR-MOV-002: location change updates current asset location
        await this.assets.update(mv.asset_id, { location_id: mv.to_location_id ?? undefined });
        break;
      case 'assignment':
        await this.assets.update(mv.asset_id, { employee_id: mv.to_employee_id ?? undefined });
        break;
      case 'return':
        await this.assets.update(mv.asset_id, { employee_id: null });
        break;
      case 'maintenance_return':
        // asset returns from maintenance → clear maintenance-only state (location stays)
        await this.assets.update(mv.asset_id, { employee_id: mv.to_employee_id ?? undefined });
        break;
      case 'disposal':
        await this.db.query(`UPDATE assets SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2`, [mv.asset_id, tenantId]);
        break;
      case 'retirement':
        await this.db.query(`UPDATE assets SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2`, [mv.asset_id, tenantId]);
        break;
      case 'missing':
        // A missing-inventory request is a review/audit action. Approval does not
        // silently dispose or deactivate the asset; a separate lifecycle decision
        // remains available to an authorized operator.
        break;
    }
  }
}

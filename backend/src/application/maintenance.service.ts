import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DatabasePort } from '../core/ports/database.port';
import { MaintenanceOrder, MaintenanceWorkflowStatus } from '../core/entities/maintenance.entity';
import {
  CompleteMaintenanceOrderInput,
  CreateMaintenanceOrderInput,
  MaintenancePort,
} from '../core/ports/maintenance.port';
import { DATABASE_PORT, MAINTENANCE_PORT } from '../core/ports/tokens';

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(MAINTENANCE_PORT) private readonly orders: MaintenancePort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, assetId: string, input: Omit<CreateMaintenanceOrderInput, 'tenant_id' | 'asset_id' | 'maintenance_code'>): Promise<MaintenanceOrder> {
    await this.db.setTenant(tenantId);
    const asset = await this.db.query<{ id: string; status_id: string | null; is_active: boolean }>(
      `SELECT id, status_id, is_active FROM assets WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [assetId, tenantId],
    );
    if (!asset.rows[0]) throw new Error('ASSET_NOT_FOUND');
    if (!asset.rows[0].is_active) throw new Error('ASSET_INACTIVE');

    const inFlight = await this.db.query<{ id: string }>(
      `SELECT id FROM maintenance_orders
        WHERE asset_id = $1 AND tenant_id = $2 AND workflow_status IN ('open', 'in_progress') LIMIT 1`,
      [assetId, tenantId],
    );
    if (inFlight.rows[0]) throw new Error('MAINTENANCE_ALREADY_OPEN');

    const sequence = await this.db.query<{ count: string }>(
      `SELECT count(*) AS count FROM maintenance_orders WHERE tenant_id = $1`, [tenantId],
    );
    const code = `MNT-${new Date().getUTCFullYear()}-${String(Number(sequence.rows[0]?.count ?? 0) + 1).padStart(4, '0')}`;
    const order = await this.orders.create({
      ...input,
      tenant_id: tenantId,
      asset_id: assetId,
      maintenance_code: code,
      previous_status_id: asset.rows[0].status_id,
    });
    await this.log(tenantId, input.created_by ?? null, AUDIT_EVENTS.MAINTENANCE_CREATED, order);
    return order;
  }

  async list(tenantId: string, workflowStatus?: MaintenanceWorkflowStatus): Promise<MaintenanceOrder[]> {
    await this.db.setTenant(tenantId);
    return this.orders.list(tenantId, workflowStatus);
  }

  async listByAsset(tenantId: string, assetId: string): Promise<MaintenanceOrder[]> {
    await this.db.setTenant(tenantId);
    return this.orders.listByAsset(assetId, tenantId);
  }

  async start(tenantId: string, id: string, userId: string): Promise<MaintenanceOrder> {
    await this.db.setTenant(tenantId);
    const order = await this.requireOrder(id, tenantId);
    if (order.workflow_status !== 'open') throw new Error('MAINTENANCE_NOT_OPEN');
    const maintenanceStatusId = await this.statusId(tenantId, 'Maintenance');
    const updated = await this.orders.start(id, tenantId, maintenanceStatusId, userId);
    if (!updated) throw new Error('MAINTENANCE_NOT_FOUND');
    await this.db.query(
      `UPDATE assets SET status_id = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [order.asset_id, tenantId, maintenanceStatusId],
    );
    await this.log(tenantId, userId, AUDIT_EVENTS.MAINTENANCE_STARTED, updated);
    return updated;
  }

  async complete(tenantId: string, id: string, userId: string, input: Omit<CompleteMaintenanceOrderInput, 'updated_by' | 'status_id'>): Promise<MaintenanceOrder> {
    await this.db.setTenant(tenantId);
    const order = await this.requireOrder(id, tenantId);
    if (order.workflow_status !== 'in_progress') throw new Error('MAINTENANCE_NOT_IN_PROGRESS');
    const restoredStatusId = order.previous_status_id ?? await this.statusId(tenantId, 'Good');
    const updated = await this.orders.complete(id, tenantId, { ...input, updated_by: userId, status_id: restoredStatusId });
    if (!updated) throw new Error('MAINTENANCE_NOT_FOUND');
    await this.db.query(
      `UPDATE assets SET status_id = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [order.asset_id, tenantId, restoredStatusId],
    );
    await this.log(tenantId, userId, AUDIT_EVENTS.MAINTENANCE_COMPLETED, updated);
    return updated;
  }

  private async requireOrder(id: string, tenantId: string): Promise<MaintenanceOrder> {
    const order = await this.orders.findById(id, tenantId);
    if (!order) throw new Error('MAINTENANCE_NOT_FOUND');
    return order;
  }

  private async statusId(tenantId: string, name: string): Promise<string> {
    const status = await this.db.query<{ id: string }>(
      `SELECT id FROM statuses WHERE tenant_id = $1 AND lower(name) = lower($2) AND is_active = true LIMIT 1`,
      [tenantId, name],
    );
    if (!status.rows[0]) throw new Error('MAINTENANCE_STATUS_NOT_CONFIGURED');
    return status.rows[0].id;
  }

  private async log(tenantId: string, userId: string | null, action: string, order: MaintenanceOrder): Promise<void> {
    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action,
      entity: 'maintenance_order',
      entityId: order.id,
      metadata: { asset_id: order.asset_id, maintenance_code: order.maintenance_code, workflow_status: order.workflow_status },
    }).catch(() => undefined);
  }
}

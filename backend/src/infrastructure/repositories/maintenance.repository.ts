import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { MaintenanceOrder, MaintenanceWorkflowStatus } from '../../core/entities/maintenance.entity';
import {
  CompleteMaintenanceOrderInput,
  CreateMaintenanceOrderInput,
  MaintenancePort,
} from '../../core/ports/maintenance.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class MaintenanceRepository implements MaintenancePort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateMaintenanceOrderInput): Promise<MaintenanceOrder> {
    const { rows } = await this.db.query<MaintenanceOrder>(
      `INSERT INTO maintenance_orders
         (tenant_id, asset_id, maintenance_code, maintenance_type, technician_name,
          technician_contact, next_maintenance_date, priority, previous_status_id,
          workflow_status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$10)
       RETURNING *`,
      [
        input.tenant_id, input.asset_id, input.maintenance_code,
        input.maintenance_type ?? null, input.technician_name ?? null,
        input.technician_contact ?? null, input.next_maintenance_date ?? null,
        input.priority ?? 'medium', input.previous_status_id ?? null,
        input.created_by ?? null,
      ],
    );
    return rows[0];
  }

  async findById(id: string, tenantId: string): Promise<MaintenanceOrder | null> {
    const { rows } = await this.db.query<MaintenanceOrder>(
      `${this.baseSelect()} WHERE mo.id = $1 AND mo.tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string, workflowStatus?: MaintenanceWorkflowStatus): Promise<MaintenanceOrder[]> {
    const params: unknown[] = [tenantId];
    let where = 'mo.tenant_id = $1';
    if (workflowStatus) {
      params.push(workflowStatus);
      where += ` AND mo.workflow_status = $${params.length}`;
    }
    const { rows } = await this.db.query<MaintenanceOrder>(
      `${this.baseSelect()} WHERE ${where} ORDER BY mo.created_at DESC`,
      params,
    );
    return rows;
  }

  async listByAsset(assetId: string, tenantId: string): Promise<MaintenanceOrder[]> {
    const { rows } = await this.db.query<MaintenanceOrder>(
      `${this.baseSelect()} WHERE mo.asset_id = $1 AND mo.tenant_id = $2 ORDER BY mo.created_at DESC`,
      [assetId, tenantId],
    );
    return rows;
  }

  async start(id: string, tenantId: string, maintenanceStatusId: string, updatedBy: string): Promise<MaintenanceOrder | null> {
    const { rows } = await this.db.query<MaintenanceOrder>(
      `UPDATE maintenance_orders
          SET workflow_status = 'in_progress',
              status_id = $3,
              start_date = COALESCE(start_date, CURRENT_DATE),
              updated_by = $4,
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
      [id, tenantId, maintenanceStatusId, updatedBy],
    );
    return rows[0] ?? null;
  }

  async complete(id: string, tenantId: string, input: CompleteMaintenanceOrderInput): Promise<MaintenanceOrder | null> {
    const { rows } = await this.db.query<MaintenanceOrder>(
      `UPDATE maintenance_orders
          SET workflow_status = 'completed',
              status_id = $3,
              end_date = COALESCE($4::date, CURRENT_DATE),
              cost = COALESCE($5, cost),
              next_maintenance_date = COALESCE($6::date, next_maintenance_date),
              updated_by = $7,
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
      [id, tenantId, input.status_id, input.end_date ?? null, input.cost ?? null, input.next_maintenance_date ?? null, input.updated_by],
    );
    return rows[0] ?? null;
  }

  private baseSelect(): string {
    return `SELECT mo.*, a.name AS asset_name, a.full_asset_code AS asset_code
            FROM maintenance_orders mo
            JOIN assets a ON a.id = mo.asset_id AND a.tenant_id = mo.tenant_id`;
  }
}

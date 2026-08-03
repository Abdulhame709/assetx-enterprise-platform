/**
 * MovementRepository — infrastructure implementation of MovementPort.
 * Reference: Data Dictionary (DOC-24) TB-MOVEMENT · ADR-007 (status lifecycle)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { AssetMovement, MovementStatus, MovementType } from '../../core/entities/movement.entity';
import { CreateMovementInput, MovementPort } from '../../core/ports/movement.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class MovementRepository implements MovementPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateMovementInput): Promise<AssetMovement> {
    const { rows } = await this.db.query<AssetMovement>(
      `INSERT INTO asset_movements
         (tenant_id, asset_id, movement_type,
          from_location_id, to_location_id, from_employee_id, to_employee_id,
          from_status_id, to_status_id, reason, reference_number, quantity, notes,
          performed_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
       RETURNING *`,
      [
        input.tenant_id, input.asset_id, input.movement_type,
        input.from_location_id ?? null, input.to_location_id ?? null,
        input.from_employee_id ?? null, input.to_employee_id ?? null,
        input.from_status_id ?? null, input.to_status_id ?? null,
        input.reason ?? null, input.reference_number ?? null,
        input.quantity ?? null, input.notes ?? null, input.performed_by ?? null,
      ],
    );
    return rows[0];
  }

  async findById(id: string, tenantId: string): Promise<AssetMovement | null> {
    const { rows } = await this.db.query<AssetMovement>(
      `SELECT * FROM asset_movements WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async listByAsset(assetId: string, tenantId: string): Promise<AssetMovement[]> {
    const { rows } = await this.db.query<AssetMovement>(
      `SELECT * FROM asset_movements WHERE asset_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [assetId, tenantId],
    );
    return rows;
  }

  async list(tenantId: string, filter?: { status?: MovementStatus; movement_type?: MovementType }): Promise<AssetMovement[]> {
    let where = `tenant_id = $1`;
    const params: unknown[] = [tenantId];
    if (filter?.status) { params.push(filter.status); where += ` AND status = $${params.length}`; }
    if (filter?.movement_type) { params.push(filter.movement_type); where += ` AND movement_type = $${params.length}`; }
    const { rows } = await this.db.query<AssetMovement>(
      `SELECT * FROM asset_movements WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows;
  }

  async setStatus(id: string, tenantId: string, status: MovementStatus, approverId: string): Promise<AssetMovement | null> {
    const { rows } = await this.db.query<AssetMovement>(
      `UPDATE asset_movements SET
         status = $3::text,
         approved_by = CASE WHEN $3::text = 'approved' THEN $4::uuid ELSE approved_by END,
         approved_at = CASE WHEN $3::text = 'approved' THEN now() ELSE approved_at END
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, status, approverId],
    );
    return rows[0] ?? null;
  }

  async hasPending(id: string, assetId: string, tenantId: string, type: MovementType, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_movements
       WHERE asset_id = $1 AND tenant_id = $2 AND movement_type = $3::movement_type AND status = 'pending'
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [assetId, tenantId, type, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }
}

/**
 * StatusRepository — infrastructure implementation of StatusPort.
 * Reference: Data Dictionary (DOC-24) TB-STATUS
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Status } from '../../core/entities/status.entity';
import {
  StatusPort,
  CreateStatusInput,
  UpdateStatusInput,
} from '../../core/ports/status.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class StatusRepository implements StatusPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateStatusInput): Promise<Status> {
    const { rows } = await this.db.query<Status>(
      `INSERT INTO statuses (tenant_id, name, color)
       VALUES ($1,$2,$3) RETURNING *`,
      [input.tenant_id, input.name, input.color ?? null],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateStatusInput): Promise<Status | null> {
    const { rows } = await this.db.query<Status>(
      `UPDATE statuses SET
         name = COALESCE($3, name),
         color = COALESCE($4, color),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, input.name ?? null, input.color ?? null],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Status | null> {
    const { rows } = await this.db.query<Status>(
      `SELECT * FROM statuses WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Status[]> {
    const { rows } = await this.db.query<Status>(
      `SELECT * FROM statuses WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [tenantId],
    );
    return rows;
  }

  async existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM statuses
       WHERE tenant_id = $1 AND is_active = true AND name ILIKE $2
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, name.trim(), excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async countAssets(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE status_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }
}

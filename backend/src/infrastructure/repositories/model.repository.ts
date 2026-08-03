/**
 * ModelRepository — infrastructure implementation of ModelPort.
 * Reference: Data Dictionary (DOC-24) TB-ASSET-MODEL
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Model } from '../../core/entities/model.entity';
import { ModelPort, CreateModelInput, UpdateModelInput } from '../../core/ports/model.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class ModelRepository implements ModelPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateModelInput): Promise<Model> {
    const { rows } = await this.db.query<Model>(
      `INSERT INTO asset_models (tenant_id, category_id, sub_type_id, name)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [input.tenant_id, input.category_id ?? null, input.sub_type_id ?? null, input.name],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateModelInput): Promise<Model | null> {
    const { rows } = await this.db.query<Model>(
      `UPDATE asset_models SET
         name = COALESCE($3, name),
         category_id = COALESCE($4, category_id),
         sub_type_id = COALESCE($5, sub_type_id),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, input.name ?? null, input.category_id ?? null, input.sub_type_id ?? null],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Model | null> {
    const { rows } = await this.db.query<Model>(
      `SELECT * FROM asset_models WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Model[]> {
    const { rows } = await this.db.query<Model>(
      `SELECT * FROM asset_models WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [tenantId],
    );
    return rows;
  }

  async existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_models
       WHERE tenant_id = $1 AND is_active = true AND name ILIKE $2
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, name.trim(), excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }
}

/**
 * CategoryRepository — infrastructure implementation of CategoryPort.
 * Reference: Data Dictionary (DOC-24) TB-CATEGORY
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Category } from '../../core/entities/category.entity';
import {
  CategoryPort,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../core/ports/category.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class CategoryRepository implements CategoryPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    const level = input.parent_id
      ? (await this.db.query<{ level_number: number }>(`SELECT level_number FROM asset_categories WHERE id = $1 LIMIT 1`, [input.parent_id])).rows[0]?.level_number ?? 0 + 1
      : 0;
    const fullPath = input.parent_id
      ? `${(await this.db.query<{ full_path: string }>(`SELECT full_path FROM asset_categories WHERE id = $1 LIMIT 1`, [input.parent_id])).rows[0]?.full_path ?? ''} / ${input.name}`
      : input.name;
    const { rows } = await this.db.query<Category>(
      `INSERT INTO asset_categories (tenant_id, name, parent_id, full_path, level_number)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.tenant_id, input.name, input.parent_id ?? null, fullPath, level],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category | null> {
    const { rows } = await this.db.query<Category>(
      `UPDATE asset_categories SET
         name = COALESCE($3, name),
         parent_id = COALESCE($4, parent_id),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, input.name ?? null, input.parent_id ?? null],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Category | null> {
    const { rows } = await this.db.query<Category>(
      `SELECT * FROM asset_categories WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Category[]> {
    const { rows } = await this.db.query<Category>(
      `SELECT * FROM asset_categories WHERE tenant_id = $1 AND is_active = true ORDER BY level_number, name`,
      [tenantId],
    );
    return rows;
  }

  async existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_categories
       WHERE tenant_id = $1 AND is_active = true AND name ILIKE $2
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, name.trim(), excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async countAssets(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE category_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async countChildren(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_categories WHERE parent_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async deactivate(id: string, tenantId: string): Promise<void> {
    await this.db.query(
      `UPDATE asset_categories SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
  }
}

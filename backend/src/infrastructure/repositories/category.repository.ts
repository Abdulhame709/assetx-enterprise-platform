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
    const parent = input.parent_id
      ? (await this.db.query<{ level_number: number; full_path: string }>(
        `SELECT level_number, full_path
           FROM asset_categories
          WHERE id = $1 AND tenant_id = $2 AND is_active = true
          LIMIT 1`,
        [input.parent_id, input.tenant_id],
      )).rows[0]
      : null;
    const level = parent ? (parent.level_number ?? 0) + 1 : 0;
    const fullPath = parent ? `${parent.full_path ?? ''} / ${input.name}` : input.name;
    const { rows } = await this.db.query<Category>(
      `INSERT INTO asset_categories (tenant_id, name, parent_id, full_path, level_number)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.tenant_id, input.name, input.parent_id ?? null, fullPath, level],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category | null> {
    const parentProvided = input.parent_id !== undefined;
    const { rows } = await this.db.query<Category>(
      `WITH RECURSIVE tree AS (
         SELECT c.id,
                c.parent_id,
                c.name,
                COALESCE($3::text, c.name) AS effective_name,
                CASE WHEN p.id IS NULL THEN COALESCE($3::text, c.name)
                     ELSE p.full_path || ' / ' || COALESCE($3::text, c.name) END AS new_full_path,
                CASE WHEN p.id IS NULL THEN 0
                     ELSE COALESCE(p.level_number, 0) + 1 END AS new_level
           FROM asset_categories c
           LEFT JOIN asset_categories p
             ON p.id = CASE WHEN $5::boolean THEN $4::uuid ELSE c.parent_id END
            AND p.tenant_id = $2
            AND p.is_active = true
          WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_active = true
         UNION ALL
         SELECT child.id,
                child.parent_id,
                child.name,
                child.name AS effective_name,
                tree.new_full_path || ' / ' || child.name,
                tree.new_level + 1
           FROM asset_categories child
           JOIN tree ON child.parent_id = tree.id
          WHERE child.tenant_id = $2 AND child.is_active = true
       )
       UPDATE asset_categories target
          SET name = CASE WHEN target.id = $1::uuid THEN COALESCE($3::text, target.name) ELSE target.name END,
              parent_id = CASE WHEN target.id = $1::uuid
                               THEN CASE WHEN $5::boolean THEN $4::uuid ELSE target.parent_id END
                               ELSE target.parent_id END,
              full_path = tree.new_full_path,
              level_number = tree.new_level,
              updated_at = now()
         FROM tree
        WHERE target.id = tree.id AND target.tenant_id = $2
        RETURNING target.*`,
      [id, tenantId, input.name ?? null, input.parent_id ?? null, parentProvided],
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

  async existsName(tenantId: string, name: string, parentId?: string | null, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_categories
       WHERE tenant_id = $1 AND is_active = true AND name ILIKE $2
         AND parent_id IS NOT DISTINCT FROM $3::uuid
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [tenantId, name.trim(), parentId ?? null, excludeId ?? null],
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

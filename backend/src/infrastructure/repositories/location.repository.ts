/**
 * LocationRepository — infrastructure implementation of LocationPort.
 * Reference: Data Dictionary (DOC-24) TB-LOCATION · ADR-005 (materialized path)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Location } from '../../core/entities/location.entity';
import {
  LocationPort,
  CreateLocationInput,
  UpdateLocationInput,
} from '../../core/ports/location.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class LocationRepository implements LocationPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  private slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
  }

  async create(input: CreateLocationInput): Promise<Location> {
    const parentPath = input.parent_id
      ? (await this.db.query<{ path: string }>(`SELECT path FROM locations WHERE id = $1 LIMIT 1`, [input.parent_id])).rows[0]?.path
      : null;
    const level = parentPath ? (await this.db.query<{ level_number: number }>(`SELECT level_number FROM locations WHERE id = $1 LIMIT 1`, [input.parent_id])).rows[0].level_number + 1 : 0;
    const path = parentPath ? `${parentPath}.${this.slugify(input.name)}` : this.slugify(input.name);
    const fullPath = input.parent_id
      ? `${(await this.db.query<{ full_path: string }>(`SELECT full_path FROM locations WHERE id = $1 LIMIT 1`, [input.parent_id])).rows[0].full_path} / ${input.name}`
      : input.name;

    const { rows } = await this.db.query<Location>(
      `INSERT INTO locations (tenant_id, parent_id, name, location_type, path, full_path, level_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.tenant_id, input.parent_id ?? null, input.name, input.location_type ?? 'room', path, fullPath, level],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateLocationInput): Promise<Location | null> {
    const current = (await this.db.query<Pick<Location, 'parent_id' | 'path' | 'full_path' | 'level_number' | 'name'>>(
      `SELECT parent_id, path, full_path, level_number, name
         FROM locations
        WHERE id = $1 AND tenant_id = $2 AND is_active = true
        LIMIT 1`,
      [id, tenantId],
    )).rows[0];
    if (!current) return null;

    const parent = current.parent_id
      ? (await this.db.query<Pick<Location, 'path' | 'full_path' | 'level_number'>>(
        `SELECT path, full_path, level_number
           FROM locations
          WHERE id = $1 AND tenant_id = $2 AND is_active = true
          LIMIT 1`,
        [current.parent_id, tenantId],
      )).rows[0]
      : null;
    const nextName = input.name ?? current.name;
    const nextPath = parent ? `${parent.path}.${this.slugify(nextName)}` : this.slugify(nextName);
    const nextFullPath = parent ? `${parent.full_path} / ${nextName}` : nextName;
    const nextLevel = parent ? parent.level_number + 1 : 0;

    const { rows } = await this.db.query<Location>(
      `WITH RECURSIVE tree AS (
         SELECT l.id,
                l.parent_id,
                l.path AS old_path,
                l.name,
                $3::text AS new_path,
                $4::text AS new_full_path,
                $5::int AS new_level
           FROM locations l
          WHERE l.id = $1 AND l.tenant_id = $2 AND l.is_active = true
         UNION ALL
         SELECT child.id,
                child.parent_id,
                child.path AS old_path,
                child.name,
                tree.new_path || substring(child.path from char_length(tree.old_path) + 1),
                tree.new_full_path || ' / ' || child.name,
                tree.new_level + 1
           FROM locations child
           JOIN tree ON child.parent_id = tree.id
          WHERE child.tenant_id = $2 AND child.is_active = true
       )
       UPDATE locations target
          SET name = CASE WHEN target.id = $1::uuid THEN $6::text ELSE target.name END,
              location_type = CASE WHEN target.id = $1::uuid
                                   THEN COALESCE($7::text, target.location_type)
                                   ELSE target.location_type END,
              path = tree.new_path,
              full_path = tree.new_full_path,
              level_number = tree.new_level,
              updated_at = now()
         FROM tree
        WHERE target.id = tree.id AND target.tenant_id = $2
        RETURNING target.*`,
      [id, tenantId, nextPath, nextFullPath, nextLevel, nextName, input.location_type ?? null],
    );
    return rows.find((location) => location.id === id) ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Location | null> {
    const { rows } = await this.db.query<Location>(
      `SELECT l.*, lt.name_ar AS location_type_name_ar,
              lt.name_en AS location_type_name_en,
              lt.icon_key AS location_type_icon_key
         FROM locations l
         LEFT JOIN location_types lt
           ON lt.tenant_id = l.tenant_id AND lt.code = l.location_type
        WHERE l.id = $1 AND l.tenant_id = $2 AND l.is_active = true
        LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Location[]> {
    const { rows } = await this.db.query<Location>(
      `SELECT l.*, lt.name_ar AS location_type_name_ar,
              lt.name_en AS location_type_name_en,
              lt.icon_key AS location_type_icon_key
         FROM locations l
         LEFT JOIN location_types lt
           ON lt.tenant_id = l.tenant_id AND lt.code = l.location_type
        WHERE l.tenant_id = $1 AND l.is_active = true
        ORDER BY l.path`,
      [tenantId],
    );
    return rows;
  }

  async softDelete(id: string, tenantId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE locations SET is_active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return (rowCount ?? 0) > 0;
  }

  async existsName(tenantId: string, name: string, parentId?: string | null, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM locations
       WHERE tenant_id = $1 AND is_active = true AND name ILIKE $2
         AND parent_id IS NOT DISTINCT FROM $3::uuid
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [tenantId, name.trim(), parentId ?? null, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async countChildren(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM locations WHERE parent_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async countAssets(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE location_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }
}

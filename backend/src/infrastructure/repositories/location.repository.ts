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
    const { rows } = await this.db.query<Location>(
      `UPDATE locations SET
         name = COALESCE($3, name),
         location_type = COALESCE($4::location_type, location_type),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, input.name ?? null, input.location_type ?? null],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Location | null> {
    const { rows } = await this.db.query<Location>(
      `SELECT * FROM locations WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Location[]> {
    const { rows } = await this.db.query<Location>(
      `SELECT * FROM locations WHERE tenant_id = $1 AND is_active = true ORDER BY path`,
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

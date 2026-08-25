import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { LocationType } from '../../core/entities/location-type.entity';
import {
  CreateLocationTypeInput,
  LocationTypePort,
  UpdateLocationTypeInput,
} from '../../core/ports/location-type.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class LocationTypeRepository implements LocationTypePort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateLocationTypeInput): Promise<LocationType> {
    const { rows } = await this.db.query<LocationType>(
      `INSERT INTO location_types (tenant_id, code, name_ar, name_en, icon_key, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.tenant_id,
        input.code,
        input.name_ar,
        input.name_en ?? null,
        input.icon_key ?? 'map-pin',
        input.sort_order ?? 0,
      ],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateLocationTypeInput): Promise<LocationType | null> {
    const { rows } = await this.db.query<LocationType>(
      `UPDATE location_types
          SET name_ar = COALESCE($3, name_ar),
              name_en = CASE WHEN $4::boolean THEN $5::text ELSE name_en END,
              icon_key = COALESCE($6, icon_key),
              sort_order = COALESCE($7, sort_order),
              is_active = COALESCE($8, is_active),
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
      [
        id,
        tenantId,
        input.name_ar ?? null,
        input.name_en !== undefined,
        input.name_en ?? null,
        input.icon_key ?? null,
        input.sort_order ?? null,
        input.is_active ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<LocationType | null> {
    const { rows } = await this.db.query<LocationType>(
      `SELECT * FROM location_types WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async findByCode(code: string, tenantId: string, includeInactive = false): Promise<LocationType | null> {
    const { rows } = await this.db.query<LocationType>(
      `SELECT * FROM location_types
        WHERE code = $1 AND tenant_id = $2
          AND ($3::boolean OR is_active = true)
        LIMIT 1`,
      [code, tenantId, includeInactive],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string, includeInactive = false): Promise<LocationType[]> {
    const { rows } = await this.db.query<LocationType>(
      `SELECT * FROM location_types
        WHERE tenant_id = $1 AND ($2::boolean OR is_active = true)
        ORDER BY sort_order, name_ar, code`,
      [tenantId, includeInactive],
    );
    return rows;
  }

  async existsCode(tenantId: string, code: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM location_types
        WHERE tenant_id = $1 AND lower(code) = lower($2)
          AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, code, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async existsName(tenantId: string, nameAr: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM location_types
        WHERE tenant_id = $1 AND lower(trim(name_ar)) = lower(trim($2))
          AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [tenantId, nameAr, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async countLocations(code: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM locations
        WHERE tenant_id = $1 AND location_type = $2 AND is_active = true`,
      [tenantId, code],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async deactivate(id: string, tenantId: string): Promise<void> {
    await this.db.query(
      `UPDATE location_types SET is_active = false, updated_at = now()
        WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
  }
}

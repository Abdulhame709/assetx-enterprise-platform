/**
 * AssetRepository — infrastructure implementation of AssetPort against PostgreSQL.
 * Reference: Data Dictionary (DOC-24) TB-ASSET · API Spec (DOC-10) Asset endpoints
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Asset, AssetSummary } from '../../core/entities/asset.entity';
import {
  AssetFilter,
  AssetPort,
  CreateAssetInput,
  UpdateAssetInput,
} from '../../core/ports/asset.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class AssetRepository implements AssetPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /** Generate base code YYYY-NNNN using the first gap (BR-CODE-001). */
  async nextBaseCode(year: number): Promise<string> {
    // Find the first unused NNNN for the year (gap reuse).
    const { rows } = await this.db.query<{ n: number }>(
      `SELECT generate_series(1, (SELECT GREATEST(count(*)+1, 1) FROM assets WHERE base_asset_code LIKE $1))
         AS n
       EXCEPT
       SELECT DISTINCT substring(base_asset_code from '-(\\d+)$')::int
         FROM assets WHERE base_asset_code LIKE $1
       ORDER BY n
       LIMIT 1`,
      [`${year}-%`],
    );
    const seq = rows[0] ? rows[0].n : 1;
    return `${year}-${String(seq).padStart(4, '0')}`;
  }

  async create(input: CreateAssetInput): Promise<AssetSummary> {
    const year = new Date().getFullYear();
    const base_asset_code = await this.nextBaseCode(year);
    // full code = base@location-slug (BR-CODE-001)
    const loc = await this.db.query<{ full_path: string }>(
      `SELECT full_path FROM locations WHERE id = $1 LIMIT 1`,
      [input.location_id],
    );
    const locSlug = (loc.rows[0]?.full_path ?? 'loc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
    const full_asset_code = `${base_asset_code}@${locSlug}`;

    const { rows } = await this.db.query<Asset>(
      `INSERT INTO assets
         (tenant_id, name, base_asset_code, full_asset_code, description,
          category_id, sub_type_id, model_id, location_id, quantity, status_id,
          employee_id, purchase_price, purchase_date, depreciation_rate, useful_life,
          serial_number, barcode, reference_number, inventory_year, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        input.tenant_id, input.name, base_asset_code, full_asset_code,
        input.description ?? null,
        input.category_id ?? null, input.sub_type_id ?? null, input.model_id ?? null,
        input.location_id ?? null, input.quantity ?? 1, input.status_id ?? null,
        input.employee_id ?? null, input.purchase_price ?? 0,
        input.purchase_date ?? null, input.depreciation_rate ?? null,
        input.useful_life ?? null, input.serial_number ?? null, input.barcode ?? null,
        input.reference_number ?? null, input.inventory_year ?? null, input.notes ?? null,
      ],
    );
    return this.toSummary(rows[0]);
  }

  async update(id: string, input: UpdateAssetInput): Promise<AssetSummary | null> {
    const { rows } = await this.db.query<Asset>(
      `UPDATE assets SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         category_id = COALESCE($4, category_id),
         model_id = COALESCE($5, model_id),
         location_id = COALESCE($6, location_id),
         quantity = COALESCE($7, quantity),
         employee_id = COALESCE($8, employee_id),
         purchase_price = COALESCE($9, purchase_price),
         notes = COALESCE($10, notes),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id, input.name ?? null, input.description ?? null,
        input.category_id ?? null, input.model_id ?? null, input.location_id ?? null,
        input.quantity ?? null, input.employee_id ?? null, input.purchase_price ?? null,
        input.notes ?? null,
      ],
    );
    return rows[0] ? this.toSummary(rows[0]) : null;
  }

  async findById(id: string, tenantId: string): Promise<Asset | null> {
    const { rows } = await this.db.query<Asset>(
      `SELECT * FROM assets WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async search(filter: AssetFilter): Promise<{ items: AssetSummary[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;
    const params: unknown[] = [filter.tenant_id];
    let where = `WHERE tenant_id = $1 AND is_active = true`;
    let idx = 2;

    if (filter.q) {
      where += ` AND (
        name ILIKE $${idx} OR full_asset_code ILIKE $${idx} OR serial_number ILIKE $${idx}
        OR barcode ILIKE $${idx} OR reference_number ILIKE $${idx}
      )`;
      params.push(`%${filter.q}%`);
      idx++;
    }
    if (filter.status_id) { where += ` AND status_id = $${idx}`; params.push(filter.status_id); idx++; }
    if (filter.category_id) { where += ` AND category_id = $${idx}`; params.push(filter.category_id); idx++; }
    if (filter.employee_id) { where += ` AND employee_id = $${idx}`; params.push(filter.employee_id); idx++; }
    if (filter.location_id) {
      // include descendants via materialized path prefix (ADR-005)
      where += ` AND location_id IN (
        SELECT id FROM locations WHERE tenant_id = $1 AND path <@ (SELECT path FROM locations WHERE id = $${idx})
      )`;
      params.push(filter.location_id);
      idx++;
    }

    const { rows } = await this.db.query<Asset>(`SELECT * FROM assets ${where} ORDER BY name LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]);
    const { rows: countRows } = await this.db.query<{ c: string }>(`SELECT count(*) AS c FROM assets ${where}`, params);
    return {
      items: rows.map((r) => this.toSummary(r)),
      total: Number(countRows[0]?.c ?? 0),
    };
  }

  async updateStatus(id: string, tenantId: string, statusId: string): Promise<AssetSummary | null> {
    const { rows } = await this.db.query<Asset>(
      `UPDATE assets SET status_id = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, statusId],
    );
    return rows[0] ? this.toSummary(rows[0]) : null;
  }

  private toSummary(a: Asset): AssetSummary {
    return {
      id: a.id,
      name: a.name,
      full_asset_code: a.full_asset_code,
      base_asset_code: a.base_asset_code,
      quantity: a.quantity,
      status_id: a.status_id,
      location_id: a.location_id,
      employee_id: a.employee_id,
      purchase_price: a.purchase_price,
      is_active: a.is_active,
    };
  }
}

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
import { generateBaseAssetCode, generateFullAssetCode } from '../../application/asset-algorithms';

@Injectable()
export class AssetRepository implements AssetPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /** Generate base code YYYY-NNNN using the first gap (BR-CODE-001). */
  async nextBaseCode(year: number): Promise<string> {
    const { rows } = await this.db.query<{ base_asset_code: string }>(
      `SELECT base_asset_code FROM assets
       WHERE base_asset_code LIKE $1`,
      [`${year}-%`],
    );
    return generateBaseAssetCode(year, rows.map((row) => row.base_asset_code));
  }

  async create(input: CreateAssetInput): Promise<AssetSummary> {
    const year = new Date().getFullYear();
    const base_asset_code = await this.nextBaseCode(year);
    // full code = base@location-slug (BR-CODE-001)
    const loc = await this.db.query<{ full_path: string }>(
      `SELECT full_path FROM locations WHERE id = $1 LIMIT 1`,
      [input.location_id],
    );
    const usedFullCodes = await this.db.query<{ full_asset_code: string }>(
      `SELECT full_asset_code FROM assets WHERE base_asset_code = $1`,
      [base_asset_code],
    );
    const full_asset_code = generateFullAssetCode(
      base_asset_code,
      loc.rows[0]?.full_path ?? 'location',
      usedFullCodes.rows.map((row) => row.full_asset_code),
    );

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
      // Include descendants via materialized path prefix (ADR-005).
      // LTREE's `<@` operator is unavailable in PGlite (path is a text column,
      // "LTREE-compatible" per migration 001) — this text-equivalent preserves
      // the ADR-005 semantics: path equals the target OR starts with `<target>.'
      where += ` AND location_id IN (
        SELECT id FROM locations WHERE tenant_id = $1 AND (
          path = (SELECT path FROM locations WHERE id = $${idx})
          OR path LIKE (SELECT path FROM locations WHERE id = $${idx}) || '.%'
        )
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

  /** Advanced search with dynamic filters + sorting (Phase 11.4). */
  async searchAdvanced(filter: AssetFilter): Promise<{ items: AssetSummary[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;
    const params: unknown[] = [filter.tenant_id];
    let where = `WHERE tenant_id = $1`;
    let idx = 2;

    if (filter.is_active !== undefined) {
      where += ` AND is_active = $${idx}`; params.push(filter.is_active); idx++;
    } else {
      where += ` AND is_active = true`;
    }
    if (filter.q) {
      where += ` AND (name ILIKE $${idx} OR full_asset_code ILIKE $${idx} OR base_asset_code ILIKE $${idx}
        OR serial_number ILIKE $${idx} OR barcode ILIKE $${idx} OR reference_number ILIKE $${idx})`;
      params.push(`%${filter.q}%`); idx++;
    }
    if (filter.status_id) { where += ` AND status_id = $${idx}`; params.push(filter.status_id); idx++; }
    if (filter.category_id) { where += ` AND category_id = $${idx}`; params.push(filter.category_id); idx++; }
    if (filter.employee_id) { where += ` AND employee_id = $${idx}`; params.push(filter.employee_id); idx++; }
    if (filter.barcode) { where += ` AND barcode ILIKE $${idx}`; params.push(`%${filter.barcode}%`); idx++; }
    if (filter.serial_number) { where += ` AND serial_number ILIKE $${idx}`; params.push(`%${filter.serial_number}%`); idx++; }
    if (filter.reference_number) { where += ` AND reference_number ILIKE $${idx}`; params.push(`%${filter.reference_number}%`); idx++; }
    if (filter.purchase_date_from) { where += ` AND purchase_date >= $${idx}::date`; params.push(filter.purchase_date_from); idx++; }
    if (filter.purchase_date_to) { where += ` AND purchase_date <= $${idx}::date`; params.push(filter.purchase_date_to); idx++; }
    if (filter.price_from !== undefined) { where += ` AND purchase_price >= $${idx}`; params.push(filter.price_from); idx++; }
    if (filter.price_to !== undefined) { where += ` AND purchase_price <= $${idx}`; params.push(filter.price_to); idx++; }
    if (filter.location_id) {
      // Include descendants via materialized path prefix (ADR-005).
      // Text-equivalent of LTREE `<@` for the text `path` column (see above).
      where += ` AND location_id IN (SELECT id FROM locations WHERE tenant_id = $1 AND (
          path = (SELECT path FROM locations WHERE id = $${idx})
          OR path LIKE (SELECT path FROM locations WHERE id = $${idx}) || '.%'
        ))`;
      params.push(filter.location_id); idx++;
    }

    const sortField = this.safeSort(filter.sortField ?? 'name');
    const sortDir = filter.sortDir === 'desc' ? 'DESC' : 'ASC';
    const { rows } = await this.db.query<Asset>(
      `SELECT * FROM assets ${where} ORDER BY ${sortField} ${sortDir} LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset],
    );
    const { rows: countRows } = await this.db.query<{ c: string }>(`SELECT count(*) AS c FROM assets ${where}`, params);
    return { items: rows.map((r) => this.toSummary(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  private safeSort(field: string): string {
    const allowed = ['name', 'full_asset_code', 'purchase_date', 'purchase_price', 'created_at', 'quantity'];
    return allowed.includes(field) ? field : 'name';
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

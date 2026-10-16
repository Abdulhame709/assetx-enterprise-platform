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
import { PLACEHOLDER_EMPLOYEE_PATTERN } from '../../core/constants/placeholder-employee';
import {
  findBaseCodeForName,
  foldAssetName,
  generateBaseAssetCode,
  generateFullAssetCode,
} from '../../application/asset-algorithms';

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

  /**
   * One name = one base code. Looks up the code already carried by this name
   * (spacing, hamza/alef, ya, ta-marbuta differences are ignored) so every
   * record of the same asset shares it; null when the name is new.
   * `excludeId` skips the record being renamed.
   */
  async baseCodeForName(name: string, excludeId?: string): Promise<string | null> {
    if (!foldAssetName(name)) return null;
    const { rows } = await this.db.query<{ id: string; name: string; base_asset_code: string }>(
      `SELECT id, name, base_asset_code FROM assets WHERE base_asset_code IS NOT NULL`,
    );
    return findBaseCodeForName(name, rows.filter((row) => row.id !== excludeId));
  }

  private async fullCodeFor(baseCode: string, locationId: string | null, excludeId?: string): Promise<string> {
    const loc = await this.db.query<{ full_path: string }>(
      `SELECT full_path FROM locations WHERE id = $1 LIMIT 1`,
      [locationId],
    );
    const used = await this.db.query<{ id: string; full_asset_code: string }>(
      `SELECT id, full_asset_code FROM assets WHERE base_asset_code = $1`,
      [baseCode],
    );
    return generateFullAssetCode(
      baseCode,
      loc.rows[0]?.full_path ?? 'location',
      used.rows.filter((row) => row.id !== excludeId).map((row) => row.full_asset_code),
    );
  }

  async create(input: CreateAssetInput): Promise<AssetSummary> {
    const year = new Date().getFullYear();
    const base_asset_code = (await this.baseCodeForName(input.name)) ?? (await this.nextBaseCode(year));
    // full code = base@location-slug (BR-CODE-001): unique per record, internal key
    const full_asset_code = await this.fullCodeFor(base_asset_code, input.location_id ?? null);

    const { rows } = await this.db.query<Asset>(
      `INSERT INTO assets
         (tenant_id, name, base_asset_code, full_asset_code, description,
          category_id, sub_type_id, model_id, location_id, quantity, status_id,
          employee_id, purchase_price, purchase_date, depreciation_rate, useful_life,
          serial_number, barcode, reference_number, inventory_year, notes, legacy_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
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
        input.legacy_code ?? null,
      ],
    );
    return this.toSummary(rows[0]);
  }

  /**
   * A rename can move a record to another asset identity: it adopts the base
   * code already used by the new name, or — if it was sharing its old code with
   * other names — receives a fresh one. Returns null when the code stays.
   */
  private async recodeForRename(
    id: string,
    newName: string,
    newLocationId: string | null | undefined,
  ): Promise<{ base_asset_code: string; full_asset_code: string } | null> {
    const cur = await this.db.query<{ name: string; base_asset_code: string; location_id: string | null }>(
      `SELECT name, base_asset_code, location_id FROM assets WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = cur.rows[0];
    if (!row || foldAssetName(row.name) === foldAssetName(newName)) return null;

    let base = await this.baseCodeForName(newName, id);
    if (!base) {
      const siblings = await this.db.query<{ c: string }>(
        `SELECT count(*) AS c FROM assets WHERE base_asset_code = $1 AND id <> $2`,
        [row.base_asset_code, id],
      );
      if (Number(siblings.rows[0]?.c ?? 0) === 0) return null;
      base = await this.nextBaseCode(new Date().getFullYear());
    }
    if (base === row.base_asset_code) return null;
    const locationId = newLocationId === undefined ? row.location_id : newLocationId;
    return { base_asset_code: base, full_asset_code: await this.fullCodeFor(base, locationId, id) };
  }

  async update(id: string, input: UpdateAssetInput): Promise<AssetSummary | null> {
    const values: unknown[] = [id];
    const assignments: string[] = [];
    const has = (key: keyof UpdateAssetInput) => Object.prototype.hasOwnProperty.call(input, key);
    const add = (key: keyof UpdateAssetInput, column: string, value: unknown) => {
      if (!has(key)) return;
      assignments.push(`${column} = $${values.length + 1}`);
      values.push(value);
    };

    add('name', 'name', input.name ?? null);
    if (has('name') && input.name) {
      const recoded = await this.recodeForRename(id, input.name, has('location_id') ? input.location_id ?? null : undefined);
      if (recoded) {
        add('name', 'base_asset_code', recoded.base_asset_code);
        assignments.push(`full_asset_code = $${values.length + 1}`);
        values.push(recoded.full_asset_code);
      }
    }
    add('description', 'description', input.description ?? null);
    add('category_id', 'category_id', input.category_id ?? null);
    add('model_id', 'model_id', input.model_id ?? null);
    add('location_id', 'location_id', input.location_id ?? null);
    add('quantity', 'quantity', input.quantity ?? null);
    add('employee_id', 'employee_id', input.employee_id ?? null);
    add('purchase_price', 'purchase_price', input.purchase_price ?? null);
    add('notes', 'notes', input.notes ?? null);

    if (assignments.length === 0) {
      const { rows } = await this.db.query<Asset>(`SELECT * FROM assets WHERE id = $1 LIMIT 1`, [id]);
      return rows[0] ? this.toSummary(rows[0]) : null;
    }

    assignments.push('updated_at = now()');
    const { rows } = await this.db.query<Asset>(
      `UPDATE assets SET ${assignments.join(', ')} WHERE id = $1 RETURNING *`,
      values,
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
        name ILIKE $${idx} OR base_asset_code ILIKE $${idx} OR full_asset_code ILIKE $${idx} OR serial_number ILIKE $${idx}
        OR barcode ILIKE $${idx} OR reference_number ILIKE $${idx}
      )`;
      params.push(`%${filter.q}%`);
      idx++;
    }
    if (filter.status_id) { where += ` AND status_id = $${idx}`; params.push(filter.status_id); idx++; }
    if (filter.category_id) { where += ` AND category_id = $${idx}`; params.push(filter.category_id); idx++; }
    if (filter.employee_id) { where += ` AND employee_id = $${idx}`; params.push(filter.employee_id); idx++; }
    if (filter.no_employee) {
      where += ` AND (employee_id IS NULL OR employee_id IN (
        SELECT id FROM employees WHERE tenant_id = $1 AND name ~* $${idx}
      ))`;
      params.push(PLACEHOLDER_EMPLOYEE_PATTERN);
      idx++;
    }
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
    const allowed = ['name', 'base_asset_code', 'full_asset_code', 'purchase_date', 'purchase_price', 'created_at', 'quantity'];
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
      category_id: a.category_id,
      status_id: a.status_id,
      location_id: a.location_id,
      employee_id: a.employee_id,
      purchase_price: a.purchase_price,
      is_active: a.is_active,
    };
  }
}

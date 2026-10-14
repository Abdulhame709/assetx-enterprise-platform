/**
 * AssetTypesExportProvider — one row per asset type (category) with the number
 * of assets, total quantity and total value. Filters: location_id (that location
 * and everything under it), status_id.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { DATABASE_PORT } from '../../../core/ports/tokens';

interface TypeRow {
  name: string;
  parent_name: string | null;
  assets_count: string;
  total_quantity: string;
  total_value: string;
}

@Injectable()
export class AssetTypesExportProvider implements ExportProvider {
  readonly resource = 'asset-types';

  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const params: unknown[] = [tenantId];
    const assetWhere = ['a.tenant_id = c.tenant_id', 'a.is_active = true', 'a.category_id = c.id'];
    if (typeof filters.status_id === 'string' && filters.status_id) {
      params.push(filters.status_id);
      assetWhere.push(`a.status_id = $${params.length}`);
    }
    let join = '';
    if (typeof filters.location_id === 'string' && filters.location_id) {
      params.push(filters.location_id);
      const sel = `(SELECT path FROM locations WHERE id = $${params.length} AND tenant_id = $1)`;
      join = 'JOIN locations x ON x.id = a.location_id';
      assetWhere.push(`(x.path = ${sel} OR x.path LIKE ${sel} || '.%')`);
    }
    await this.db.setTenant(tenantId);
    const { rows } = await this.db.query<TypeRow>(
      `SELECT c.name, p.name AS parent_name,
              COALESCE(t.n, 0) AS assets_count, COALESCE(t.q, 0) AS total_quantity, COALESCE(t.v, 0) AS total_value
       FROM asset_categories c
       LEFT JOIN asset_categories p ON p.id = c.parent_id
       LEFT JOIN LATERAL (
         SELECT count(*) AS n, sum(a.quantity) AS q, sum(a.purchase_price) AS v
         FROM assets a ${join} WHERE ${assetWhere.join(' AND ')}
       ) t ON true
       WHERE c.tenant_id = $1 AND c.is_active = true
       ORDER BY COALESCE(p.name, c.name), c.name`,
      params,
    );
    // With a location/status filter, hide types that have nothing in that selection.
    const narrowed = params.length > 1;
    const out = rows
      .map((r) => ({
        category_name: r.name,
        parent_name: r.parent_name ?? '',
        assets_count: Number(r.assets_count),
        total_quantity: Number(r.total_quantity),
        total_value: Number(r.total_value),
      }))
      .filter((r) => !narrowed || r.assets_count > 0);
    return { rows: out, total: out.length };
  }
}

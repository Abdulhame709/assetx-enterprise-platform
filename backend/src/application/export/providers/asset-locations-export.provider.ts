/**
 * AssetLocationsExportProvider — one row per location with how many assets sit
 * directly in it, how many sit in it or below it, and their value.
 * Filters: location_scope = 'main' (top level) | 'sub' (nested), location_id (that
 * location and everything under it).
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { DATABASE_PORT } from '../../../core/ports/tokens';

interface LocationRow {
  full_path: string;
  parent_name: string | null;
  level_number: number;
  direct_count: string;
  total_count: string;
  total_value: string;
}

@Injectable()
export class AssetLocationsExportProvider implements ExportProvider {
  readonly resource = 'asset-locations';

  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const params: unknown[] = [tenantId];
    const where = ['l.tenant_id = $1', 'l.is_active = true'];
    if (filters.location_scope === 'main') where.push('l.parent_id IS NULL');
    if (filters.location_scope === 'sub') where.push('l.parent_id IS NOT NULL');
    if (typeof filters.location_id === 'string' && filters.location_id) {
      params.push(filters.location_id);
      const sel = `(SELECT path FROM locations WHERE id = $${params.length} AND tenant_id = $1)`;
      where.push(`(l.path = ${sel} OR l.path LIKE ${sel} || '.%')`);
    }
    await this.db.setTenant(tenantId);
    const { rows } = await this.db.query<LocationRow>(
      `SELECT l.full_path, p.full_path AS parent_name, l.level_number,
              COALESCE(d.c, 0) AS direct_count, COALESCE(t.c, 0) AS total_count, COALESCE(t.v, 0) AS total_value
       FROM locations l
       LEFT JOIN locations p ON p.id = l.parent_id
       LEFT JOIN LATERAL (
         SELECT count(*) AS c FROM assets a
         WHERE a.tenant_id = l.tenant_id AND a.is_active = true AND a.location_id = l.id
       ) d ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS c, sum(a.purchase_price) AS v FROM assets a
         JOIN locations x ON x.id = a.location_id
         WHERE a.tenant_id = l.tenant_id AND a.is_active = true AND (x.path = l.path OR x.path LIKE l.path || '.%')
       ) t ON true
       WHERE ${where.join(' AND ')}
       ORDER BY l.full_path
       LIMIT ${Math.max(1, Math.min(options?.limit ?? 10000, 10000))}`,
      params,
    );
    const out = rows.map((r) => ({
      location_name: r.full_path,
      parent_name: r.parent_name ?? '',
      level: Number(r.level_number),
      direct_count: Number(r.direct_count),
      total_count: Number(r.total_count),
      total_value: Number(r.total_value),
    }));
    return { rows: out, total: out.length };
  }
}

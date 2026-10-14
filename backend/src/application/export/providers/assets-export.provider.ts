/**
 * AssetsExportProvider — fetches asset data for export.
 * Knows only its own data source (AssetRepository). No formatting logic beyond
 * resolving ids to names and adding the detail columns the list view omits.
 * Reference: Phase 11.3 (architecture note 1)
 */
import { Inject, Injectable } from '@nestjs/common';
import { AssetPort } from '../../../core/ports/asset.port';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { ASSET_PORT, DATABASE_PORT } from '../../../core/ports/tokens';
import { isoDate, loadNameMaps, nameOf, statusName } from '../export-lookups';
import { isAssetSortKey, sortAssetRows } from '../export-sort';

interface AssetDetail {
  id: string;
  purchase_date: unknown;
  serial_number: string | null;
  barcode: string | null;
  reference_number: string | null;
  depreciation_rate: unknown;
  useful_life: unknown;
  notes: string | null;
}

@Injectable()
export class AssetsExportProvider implements ExportProvider {
  readonly resource = 'assets';

  constructor(
    @Inject(ASSET_PORT) private readonly assets: AssetPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const res = await this.assets.search({
      tenant_id: tenantId,
      page: 1,
      limit: options?.limit ?? 10000,
      ...filters,
    });
    const names = await loadNameMaps(this.db, tenantId);
    const { rows: details } = await this.db.query<AssetDetail>(
      `SELECT id, purchase_date, serial_number, barcode, reference_number, depreciation_rate, useful_life, notes
       FROM assets WHERE tenant_id = $1`,
      [tenantId],
    );
    const byId = new Map(details.map((d) => [d.id, d]));
    const rows = res.items.map((a) => {
      const d = byId.get(a.id);
      return {
        ...a,
        purchase_price: Number(a.purchase_price ?? 0),
        category_name: nameOf(names.categories, a.category_id),
        status_name: statusName(names.statuses, a.status_id),
        location_name: nameOf(names.locations, a.location_id),
        employee_name: nameOf(names.employees, a.employee_id),
        purchase_date: isoDate(d?.purchase_date),
        serial_number: d?.serial_number ?? '',
        barcode: d?.barcode ?? '',
        reference_number: d?.reference_number ?? '',
        depreciation_rate: d?.depreciation_rate ?? '',
        useful_life: d?.useful_life ?? '',
        notes: d?.notes ?? '',
      };
    });
    const sortBy = filters.sort_by;
    const ordered = isAssetSortKey(sortBy) ? sortAssetRows(rows, sortBy, filters.sort_dir === 'desc' ? 'desc' : 'asc') : rows;
    return { rows: ordered, total: res.total };
  }
}

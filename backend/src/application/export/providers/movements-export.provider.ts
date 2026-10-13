/**
 * MovementsExportProvider — fetches movement data for export.
 * Knows only its own data source (MovementRepository). No formatting logic beyond
 * resolving ids to names.
 * Reference: Phase 11.3
 */
import { Inject, Injectable } from '@nestjs/common';
import { MovementPort } from '../../../core/ports/movement.port';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { MovementStatus, MovementType } from '../../../core/entities/movement.entity';
import { DATABASE_PORT, MOVEMENT_PORT } from '../../../core/ports/tokens';
import { isoDate, loadNameMaps, nameOf, statusName } from '../export-lookups';

@Injectable()
export class MovementsExportProvider implements ExportProvider {
  readonly resource = 'movements';

  constructor(
    @Inject(MOVEMENT_PORT) private readonly movements: MovementPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = options?.filters as { status?: MovementStatus; movement_type?: MovementType } | undefined;
    const list = await this.movements.list(tenantId, filters);
    const names = await loadNameMaps(this.db, tenantId);
    const { rows: assetRows } = await this.db.query<{ id: string; name: string; full_asset_code: string }>(
      `SELECT id, name, full_asset_code FROM assets WHERE tenant_id = $1`,
      [tenantId],
    );
    const assetById = new Map(assetRows.map((a) => [a.id, a]));
    const rows = list.map((m) => {
      const asset = assetById.get(m.asset_id);
      return {
        ...m,
        asset_name: asset?.name ?? '',
        asset_code: asset?.full_asset_code ?? '',
        from_location_name: nameOf(names.locations, m.from_location_id),
        to_location_name: nameOf(names.locations, m.to_location_id),
        from_employee_name: nameOf(names.employees, m.from_employee_id),
        to_employee_name: nameOf(names.employees, m.to_employee_id),
        from_status_name: statusName(names.statuses, m.from_status_id),
        to_status_name: statusName(names.statuses, m.to_status_id),
        performed_by_name: nameOf(names.users, m.performed_by),
        created_at: isoDate(m.created_at, true),
        approved_at: isoDate(m.approved_at, true),
      };
    });
    return { rows, total: rows.length };
  }
}

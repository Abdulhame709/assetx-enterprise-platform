/**
 * InventoryFormExportProvider — the printable field-inventory form: one numbered
 * line per asset (code, name, location, custodian, expected quantity) followed by
 * empty writing cells (actual quantity, actual status, checked, notes).
 * With `blank_rows` = N it prints N empty numbered lines instead, for sites where
 * the assets are not registered yet. Takes the same filters as the assets report.
 */
import { Injectable } from '@nestjs/common';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { AssetsExportProvider } from './assets-export.provider';
import { isAssetSortKey } from '../export-sort';

/** Upper bound for blank lines so a typo cannot generate a huge file. */
export const MAX_BLANK_ROWS = 500;

const BLANK = {
  base_asset_code: '', name: '', category_name: '', location_name: '', employee_name: '',
  expected_quantity: '', actual_quantity: '', actual_status: '', checked: '', notes: '',
};

@Injectable()
export class InventoryFormExportProvider implements ExportProvider {
  readonly resource = 'inventory-form';

  constructor(private readonly assets: AssetsExportProvider) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const blank = Math.min(Math.max(Math.trunc(Number(filters.blank_rows ?? 0)) || 0, 0), MAX_BLANK_ROWS);
    if (blank > 0) {
      const rows = Array.from({ length: blank }, (_, i) => ({ row_no: i + 1, ...BLANK }));
      return { rows, total: rows.length };
    }
    // Field walks go room by room, so default to location order.
    const sortBy = isAssetSortKey(filters.sort_by) ? filters.sort_by : 'location';
    const { rows } = await this.assets.getData(tenantId, { ...options, filters: { ...filters, sort_by: sortBy } });
    const form = (rows as Array<Record<string, unknown>>).map((a, i) => ({
      row_no: i + 1,
      base_asset_code: a.base_asset_code ?? '',
      name: a.name ?? '',
      category_name: a.category_name ?? '',
      location_name: a.location_name ?? '',
      employee_name: a.employee_name ?? '',
      expected_quantity: a.quantity ?? '',
      actual_quantity: '',
      actual_status: '',
      checked: '',
      notes: '',
    }));
    return { rows: form, total: form.length };
  }
}

/**
 * Report catalog — the columns each report offers and the ones shown by default.
 * Presentation only. Feeds the Report Designer (Settings) and the Report Center
 * (Reports page) so both agree on what can be printed.
 */
import { ExportResource } from '../entities/export.entity';

export interface ReportCatalogEntry {
  /** every column the report can show, in the natural order */
  columns: string[];
  /** columns printed when the user has not customised the report */
  defaults: string[];
}

export const REPORT_CATALOG: Partial<Record<ExportResource, ReportCatalogEntry>> = {
  assets: {
    columns: [
      'base_asset_code', 'name', 'category_name', 'status_name', 'location_name', 'employee_name', 'quantity',
      'purchase_price', 'purchase_date', 'serial_number', 'barcode', 'reference_number', 'depreciation_rate',
      'useful_life', 'notes', 'legacy_code',
    ],
    defaults: ['base_asset_code', 'name', 'category_name', 'status_name', 'location_name', 'employee_name', 'quantity', 'purchase_price'],
  },
  'asset-locations': {
    columns: ['location_name', 'parent_name', 'level', 'direct_count', 'total_count', 'total_value'],
    defaults: ['location_name', 'parent_name', 'direct_count', 'total_count', 'total_value'],
  },
  'asset-types': {
    columns: ['category_name', 'parent_name', 'assets_count', 'total_quantity', 'total_value'],
    defaults: ['category_name', 'parent_name', 'assets_count', 'total_quantity', 'total_value'],
  },
  duplicates: {
    columns: [
      'group_no', 'reason', 'base_asset_code', 'name', 'serial_number', 'barcode', 'category_name', 'location_name',
      'employee_name', 'status_name', 'purchase_price',
    ],
    defaults: ['group_no', 'reason', 'base_asset_code', 'name', 'serial_number', 'category_name', 'location_name', 'employee_name'],
  },
  'inventory-form': {
    columns: [
      'row_no', 'base_asset_code', 'name', 'category_name', 'location_name', 'employee_name', 'expected_quantity',
      'actual_quantity', 'actual_status', 'checked', 'notes',
    ],
    defaults: [
      'row_no', 'base_asset_code', 'name', 'location_name', 'employee_name', 'expected_quantity',
      'actual_quantity', 'actual_status', 'checked', 'notes',
    ],
  },
  movements: {
    columns: [
      'asset_code', 'asset_name', 'movement_type', 'status', 'from_location_name', 'to_location_name',
      'from_employee_name', 'to_employee_name', 'from_status_name', 'to_status_name', 'performed_by_name',
      'created_at', 'approved_at', 'reason',
    ],
    defaults: [
      'asset_code', 'asset_name', 'movement_type', 'status', 'from_location_name', 'to_location_name',
      'to_employee_name', 'created_at',
    ],
  },
  inventory: {
    columns: [
      'asset_code', 'asset_name', 'expected_quantity', 'actual_quantity', 'expected_location_path', 'actual_location_path',
      'expected_employee_name', 'actual_employee_name', 'expected_status_name', 'actual_status_name', 'result', 'notes',
    ],
    defaults: [
      'asset_code', 'asset_name', 'expected_quantity', 'actual_quantity', 'expected_location_path',
      'actual_location_path', 'result', 'notes',
    ],
  },
  audit: {
    columns: ['created_at', 'action_type', 'entity', 'entity_id', 'user_name', 'ip_address', 'metadata'],
    defaults: ['created_at', 'action_type', 'entity', 'user_name', 'metadata'],
  },
};

/** Resources the designer can configure, in display order. */
export const DESIGNABLE_RESOURCES = Object.keys(REPORT_CATALOG) as ExportResource[];

export function isDesignableResource(value: string): value is ExportResource {
  return Object.prototype.hasOwnProperty.call(REPORT_CATALOG, value);
}

/** Columns for a report: the saved selection (kept in catalog order checks only), else the defaults. */
export function defaultColumnsFor(resource: ExportResource, saved?: string[]): string[] | undefined {
  const entry = REPORT_CATALOG[resource];
  if (!entry) return undefined;
  const valid = (saved ?? []).filter((key) => entry.columns.includes(key));
  return valid.length > 0 ? valid : entry.defaults;
}

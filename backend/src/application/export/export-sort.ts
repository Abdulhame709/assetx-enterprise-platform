/**
 * Report sorting — in-memory ordering of asset rows by a business-friendly key
 * (location, type, name, status, custodian…). Presentation only: the data was
 * already fetched and filtered by the provider.
 */
export type AssetSortKey = 'location' | 'category' | 'name' | 'status' | 'employee' | 'code' | 'price';

const FIELD_OF: Record<AssetSortKey, string> = {
  location: 'location_name',
  category: 'category_name',
  name: 'name',
  status: 'status_name',
  employee: 'employee_name',
  code: 'base_asset_code',
  price: 'purchase_price',
};

export function isAssetSortKey(value: unknown): value is AssetSortKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FIELD_OF, value);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'ar', { numeric: true, sensitivity: 'base' });
}

/**
 * Sort by `key` (then by name so the order is stable and readable).
 * Empty values go last when ascending, so "unassigned" rows do not lead the page.
 */
export function sortAssetRows<T extends Record<string, unknown>>(rows: T[], key: AssetSortKey, dir: 'asc' | 'desc' = 'asc'): T[] {
  const field = FIELD_OF[key];
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((x, y) => {
    const a = x[field];
    const b = y[field];
    const aEmpty = a === '' || a === null || a === undefined;
    const bEmpty = b === '' || b === null || b === undefined;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return sign * compare(a, b) || compare(x.name, y.name);
  });
}

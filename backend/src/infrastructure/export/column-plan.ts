/**
 * ColumnPlan — shared resolution of export column order/labels (Task T8).
 * When a profile (or caller) supplies ordered columns, generators render only
 * those keys with the display labels. Without columns it falls back to the
 * natural keys of the first row (legacy behavior — fully backward compatible).
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { ExportColumn, ExportOptions } from '../../core/entities/export.entity';

export interface ColumnPlan {
  /** ordered keys to extract from each row */
  keys: string[];
  /** display labels (header) aligned 1:1 with keys */
  labels: string[];
}

export function resolveColumnPlan(data: unknown[], options?: ExportOptions): ColumnPlan {
  const cols: ExportColumn[] | undefined = options?.columns;
  if (cols && cols.length > 0) {
    const ordered = cols.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const keys = ordered.map((c) => c.key);
    const labels = ordered.map((c) => c.label ?? c.key);
    return { keys, labels };
  }
  const keys = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
  return { keys, labels: keys };
}

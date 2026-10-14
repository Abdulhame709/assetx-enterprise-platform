/**
 * ColumnPlan — shared resolution of export column order/labels (Task T8).
 * When a profile (or caller) supplies ordered columns, generators render only
 * those keys with the display labels. Without columns it falls back to the
 * natural keys of the first row (legacy behavior — fully backward compatible).
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { ExportColumn, ExportOptions } from '../../core/entities/export.entity';
import { columnLabel } from '../../core/constants/export-labels';
import { isGroupRow } from '../../core/constants/report-groups';

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
    const lang = options?.meta?.lang;
    const labels = ordered.map((c) => (lang ? columnLabel(c.key, c.label, lang) : c.label ?? c.key));
    return { keys, labels };
  }
  // Location bands are not data: the columns come from the first real row.
  const first = data.find((row) => !isGroupRow(row));
  const keys = first ? Object.keys(first as Record<string, unknown>) : [];
  const lang = options?.meta?.lang;
  return { keys, labels: lang ? keys.map((k) => columnLabel(k, undefined, lang)) : keys };
}

/**
 * ReportBuilderService — separates report definition from execution.
 * Validates a ReportDefinition and prepares an ExportRequest for ExportService.
 * It never generates PDF/Excel itself; ExportService remains the only generator.
 * Reference: Task T5 (approved scope)
 */
import { Injectable } from '@nestjs/common';
import {
  ReportAggregation,
  ReportColumn,
  ReportDefinition,
  ReportFilter,
  ReportGroup,
  ReportSort,
} from '../core/entities/report.entity';
import { ExportFormat, ExportRequest, ExportResource } from '../core/entities/export.entity';

const VALID_RESOURCES: ExportResource[] = ['assets', 'movements', 'inventory', 'audit', 'dashboard'];
const VALID_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];
const VALID_FILTER_OPERATORS = ['eq', 'in', 'contains', 'range'];
const VALID_AGGREGATIONS: ReportAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];

@Injectable()
export class ReportBuilderService {
  /** Validate a report definition. Throws on invalid input. */
  validate(report: ReportDefinition): void {
    if (!report || !report.id || !report.name) throw new Error('INVALID_REPORT_DEFINITION');
    if (!VALID_RESOURCES.includes(report.resource)) throw new Error('INVALID_REPORT_RESOURCE');
    if (!VALID_FORMATS.includes(report.format)) throw new Error('INVALID_REPORT_FORMAT');
    if (!Array.isArray(report.columns) || report.columns.length === 0) throw new Error('REPORT_COLUMNS_REQUIRED');

    for (const c of report.columns) this.validateColumn(c);
    for (const f of report.filters ?? []) this.validateFilter(f);
    for (const s of report.sorting ?? []) this.validateSort(s);
    for (const g of report.grouping ?? []) this.validateGroup(g);
  }

  private validateColumn(c: ReportColumn): void {
    if (!c || !c.field || typeof c.field !== 'string' || c.field.trim() === '') {
      throw new Error('INVALID_REPORT_COLUMN');
    }
  }

  private validateFilter(f: ReportFilter): void {
    if (!f || !f.field || !VALID_FILTER_OPERATORS.includes(f.operator)) {
      throw new Error('INVALID_REPORT_FILTER');
    }
    // range requires from/to; eq requires value; in requires values
    if (f.operator === 'range' && f.from === undefined && f.to === undefined) throw new Error('INVALID_REPORT_FILTER');
    if (f.operator === 'eq' && f.value === undefined) throw new Error('INVALID_REPORT_FILTER');
    if (f.operator === 'in' && (!Array.isArray(f.values) || f.values.length === 0)) throw new Error('INVALID_REPORT_FILTER');
  }

  private validateSort(s: ReportSort): void {
    if (!s || !s.field || (s.dir !== 'asc' && s.dir !== 'desc')) throw new Error('INVALID_REPORT_SORT');
  }

  private validateGroup(g: ReportGroup): void {
    if (!g || !g.field) throw new Error('INVALID_REPORT_GROUP');
    if (g.aggregate && !VALID_AGGREGATIONS.includes(g.aggregate)) throw new Error('INVALID_REPORT_AGGREGATION');
  }

  /**
   * Build an ExportRequest for a valid ReportDefinition.
   * Filters are carried in ExportOptions.filters; column/sort/group metadata is
   * embedded under a reserved key for downstream execution without changing ExportService.
   */
  buildExportRequest(report: ReportDefinition, tenantId: string, userId: string): ExportRequest {
    this.validate(report);
    return {
      tenant_id: tenantId,
      userId,
      resource: report.resource,
      format: report.format,
      options: {
        includeHeaders: report.exportOptions?.includeHeaders ?? true,
        limit: report.exportOptions?.limit,
        offset: report.exportOptions?.offset,
        filters: {
          ...this.flattenFilters(report.filters),
          __report: {
            columns: report.columns.map((c) => c.field),
            sorting: report.sorting ?? [],
            grouping: report.grouping ?? [],
          },
        },
      },
    };
  }

  /**
   * Pure row transformation: column projection + sorting + grouping + aggregation.
   * No file generation — testable and reusable for any execution path.
   */
  transformRows<T extends Record<string, unknown>>(rows: T[], report: ReportDefinition): unknown[] {
    const columns = new Set(report.columns.map((c) => c.field));
    for (const s of report.sorting ?? []) columns.add(s.field);
    for (const g of report.grouping ?? []) {
      columns.add(g.field);
      if (g.valueField) columns.add(g.valueField);
    }
    const projected = rows.map((r) => this.project(r, Array.from(columns)));
    let result: Record<string, unknown>[] = projected;

    if (report.grouping && report.grouping.length > 0) {
      const groups = new Map<string, Record<string, unknown>>();
      for (const row of projected) {
        const key = JSON.stringify(report.grouping.map((g) => row[g.field] ?? null));
        const group = groups.get(key) ?? this.emptyGroup(report.grouping, row);
        if (!groups.has(key)) groups.set(key, group);
        for (const g of report.grouping) this.aggregateInto(group, g, row);
      }
      result = Array.from(groups.values()).map((row) => this.cleanAggregationInternals(row));
    }

    if (report.sorting && report.sorting.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of report.sorting!) {
          const cmp = this.compare(a[s.field], b[s.field]);
          if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return result;
  }

  private project(r: Record<string, unknown>, columns: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = r[c];
    return out;
  }

  private compare(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  }

  private emptyGroup(grouping: ReportGroup[], first: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const g of grouping) {
      out[g.field] = first[g.field];
      const agg = g.aggregate ?? 'count';
      const key = this.aggregateKey(g);
      if (agg === 'count' || agg === 'sum') out[key] = 0;
      if (agg === 'avg') {
        out[key] = 0;
        out[`__sum_${key}`] = 0;
        out[`__count_${key}`] = 0;
      }
      if (agg === 'min') out[key] = Infinity;
      if (agg === 'max') out[key] = -Infinity;
      if (g.valueField && agg !== 'count') out[agg] = out[key];
    }
    return out;
  }

  private aggregateKey(g: ReportGroup): string {
    const agg = g.aggregate ?? 'count';
    if (agg === 'count' && !g.valueField) return 'count';
    return `${agg}_${g.valueField ?? g.field}`;
  }

  private aggregateInto(group: Record<string, unknown>, g: ReportGroup, row: Record<string, unknown>): void {
    const agg = g.aggregate ?? 'count';
    const target = g.valueField ?? g.field;
    const key = this.aggregateKey(g);
    const val = row[target];
    if (agg === 'count') {
      group[key] = (group[key] as number ?? 0) + 1;
      return;
    }
    if (agg === 'sum') {
      group[key] = (group[key] as number ?? 0) + (Number(val) || 0);
      if (g.valueField) group[agg] = group[key];
      return;
    }
    if (agg === 'avg') {
      const totalKey = `__sum_${key}`;
      const countKey = `__count_${key}`;
      const total = (group[totalKey] as number ?? 0) + (Number(val) || 0);
      const count = (group[countKey] as number ?? 0) + 1;
      group[totalKey] = total;
      group[countKey] = count;
      group[key] = total / count;
      if (g.valueField) group[agg] = group[key];
      return;
    }
    const numeric = Number(val) || 0;
    group[key] = agg === 'min'
      ? Math.min(group[key] as number ?? Infinity, numeric)
      : Math.max(group[key] as number ?? -Infinity, numeric);
    if (g.valueField) group[agg] = group[key];
  }

  private cleanAggregationInternals(row: Record<string, unknown>): Record<string, unknown> {
    for (const key of Object.keys(row)) {
      if (key.startsWith('__')) delete row[key];
    }
    return row;
  }

  private flattenFilters(filters?: ReportFilter[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of filters ?? []) {
      if (f.operator === 'range') { out[`${f.field}_from`] = f.from; out[`${f.field}_to`] = f.to; }
      else if (f.operator === 'in') out[f.field] = f.values;
      else if (f.operator === 'contains') out[f.field] = f.value;
      else out[f.field] = f.value;
    }
    return out;
  }
}

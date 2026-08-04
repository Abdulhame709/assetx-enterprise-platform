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
    // keep any aggregation value fields so grouping aggregates have data
    for (const g of report.grouping ?? []) {
      if (g.valueField) columns.add(g.valueField);
    }
    const projected = rows.map((r) => this.project(r, Array.from(columns)));

    let result: Record<string, unknown>[] = projected;

    // sorting
    if (report.sorting && report.sorting.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of report.sorting!) {
          const av = a[s.field];
          const bv = b[s.field];
          const cmp = this.compare(av, bv);
          if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    // grouping + aggregation
    if (report.grouping && report.grouping.length > 0) {
      const groups = new Map<string, Record<string, unknown>>();
      for (const r of projected) {
        for (const g of report.grouping!) {
          const key = String(r[g.field] ?? '');
          const group = groups.get(key) ?? this.emptyGroup(g, r);
          if (!groups.has(key)) groups.set(key, group);
          this.aggregateInto(group, g, r);
        }
      }
      result = Array.from(groups.values());
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

  private emptyGroup(g: ReportGroup, first: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { [g.field]: first[g.field] };
    if (g.aggregate === 'count') out['count'] = 0;
    return out;
  }

  private aggregateInto(group: Record<string, unknown>, g: ReportGroup, row: Record<string, unknown>): void {
    const agg = g.aggregate ?? 'count';
    const target = g.valueField ?? g.field;
    const val = row[target];
    switch (agg) {
      case 'count': group['count'] = (group['count'] as number ?? 0) + 1; break;
      case 'sum': group['sum'] = (group['sum'] as number ?? 0) + (Number(val) || 0); break;
      case 'avg': {
        const total = (group['__sum'] as number ?? 0) + (Number(val) || 0);
        const cnt = (group['__count'] as number ?? 0) + 1;
        group['__sum'] = total; group['__count'] = cnt; group['avg'] = total / cnt; break;
      }
      case 'min': group['min'] = Math.min(group['min'] as number ?? Infinity, Number(val) || 0); break;
      case 'max': group['max'] = Math.max(group['max'] as number ?? -Infinity, Number(val) || 0); break;
    }
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

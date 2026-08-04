/**
 * Report Builder domain entities — separate report definition from execution.
 * ExportService is unchanged; ReportBuilderService validates + builds ExportRequest.
 * Reference: Task T5 (approved scope)
 */
import { ExportFormat, ExportResource } from './export.entity';

export interface ReportColumn {
  /** field/column key in the source rows */
  field: string;
  /** display label (defaults to field) */
  label?: string;
  /**
   * EXTENSION POINT (not implemented): computed-column expression, e.g.
   *   age = today - purchase_date, book_value = price - (price*rate*age), etc.
   * Reserved for future — do not populate yet; see Technical Debt Register.
   * @TODO Task: computed columns
   */
  expression?: string;
}

export type ReportFilterOperator = 'eq' | 'in' | 'contains' | 'range';

export interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value?: unknown;
  values?: unknown[];
  from?: unknown;
  to?: unknown;
}

export interface ReportSort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ReportGroup {
  /** grouping key field */
  field: string;
  /** aggregate applied within the group (count default) */
  aggregate?: ReportAggregation;
  /** numeric field the aggregate operates on (for sum/avg/min/max) */
  valueField?: string;
}

export type ReportAggregation =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max';

export interface ReportExportOptions {
  limit?: number;
  offset?: number;
  includeHeaders?: boolean;
}

export interface ReportMetadata {
  createdBy?: string;
  version?: number;
  tags?: string[];
  description?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  resource: ExportResource;
  format: ExportFormat;
  columns: ReportColumn[];
  filters?: ReportFilter[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
  exportOptions?: ReportExportOptions;
  metadata?: ReportMetadata;
}

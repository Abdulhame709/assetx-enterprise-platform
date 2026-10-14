/**
 * Export domain entities — ExportRequest/Result/Format/Options/Metadata/Mode.
 * Reference: Phase 11.3 · Task T8 · Clean Architecture (Domain layer)
 */
import { ExportProfileId } from './export-profile.entity';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ExportMode = 'SYNC' | 'ASYNC';

export type ExportResource =
  | 'assets'
  | 'movements'
  | 'inventory'
  | 'audit'
  | 'dashboard'
  | 'asset-locations'
  | 'asset-types'
  | 'duplicates'
  | 'inventory-form';

export interface ReportExecutionMetadata {
  /** selected fields to project before formatting */
  columns?: Array<{ field: string; label?: string }>;
  sorting?: Array<{ field: string; dir: 'asc' | 'desc' }>;
  grouping?: Array<{
    field: string;
    aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    valueField?: string;
  }>;
}

/** Presentation context printed on every PDF/XLSX report (header, footer, direction). */
export interface ExportMeta {
  /** resource being exported — lets generators decide which columns can be totalled */
  resource?: ExportResource;
  title?: string;
  organizationName?: string;
  /** PNG/JPEG bytes of the organization logo (optional) */
  logo?: Buffer;
  userName?: string;
  /** human-readable description of sorting/grouping/profile shown under the title */
  filtersText?: string;
  /** ISO timestamp the report was produced */
  generatedAt?: string;
  /** report language; drives labels, direction and alignment */
  lang?: 'ar' | 'en';
  dir?: 'rtl' | 'ltr';
  /** auto = landscape when the table has more than 7 columns */
  orientation?: 'auto' | 'portrait' | 'landscape';
  /** optional narrative (e.g. the AI summary) printed above the table */
  summary?: string;
  /** print a signatures block after the table */
  signatures?: boolean;
  /** diagonal "draft" watermark */
  draft?: boolean;
  /** report designer: force a page break after this many table rows (PDF) */
  rowsPerPage?: number;
  /** report designer: print the totals row (default true) */
  showTotals?: boolean;
  /** report designer: add a running row-number column */
  rowNumbers?: boolean;
  /** blank paper form (field inventory): taller rows, empty writing cells stay empty */
  formMode?: boolean;
  /** report designer: share of the table width (percent) a column takes; unlisted columns share the rest */
  columnWidths?: Record<string, number>;
}

export interface ExportOptions {
  /** presentation context for PDF/XLSX (title, organization, user, language) */
  meta?: ExportMeta;
  /** filters / parameters passed to the data provider */
  filters?: Record<string, unknown>;
  /** page size hint for streaming large datasets */
  limit?: number;
  offset?: number;
  /** whether to include a header row (CSV/Excel) */
  includeHeaders?: boolean;
  /** presentation template for PDF (presentation-only); optional */
  template?: import('./report-template.entity').ReportTemplate;
  /** ordered columns (profile-driven) — generators use these for headers/order */
  columns?: ExportColumn[];
  /** export profile id (Task T8) — resolved by ExportProfileRegistry */
  profile?: ExportProfileId;
  /** page size hint for paged streaming (Task T8; extension point) */
  pageSize?: number;
  /** cancellation signal (Task T8; prepared extension point — not yet enforced) */
  signal?: AbortSignal;
}

/** A single ordered export column (key + optional display label). */
export interface ExportColumn {
  key: string;
  label?: string;
  order?: number;
}

export interface ExportRequest {
  tenant_id: string;
  userId: string;
  resource: ExportResource;
  format: ExportFormat;
  options?: ExportOptions;
  mode?: ExportMode;
}

export interface ExportMetadata {
  resource: ExportResource;
  format: ExportFormat;
  rows: number;
  size: number;
  duration: number;   // ms
  user: string;
  tenant: string;
  mode: ExportMode;
  generated_at: string;
}

export interface ExportResult {
  /** readable stream of the generated file */
  stream: NodeJS.ReadableStream;
  format: ExportFormat;
  filename: string;
  mimeType: string;
  metadata: ExportMetadata;
}

/**
 * Export domain entities — ExportRequest/Result/Format/Options/Metadata/Mode.
 * Reference: Phase 11.3 · Clean Architecture (Domain layer)
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ExportMode = 'SYNC' | 'ASYNC';

export type ExportResource =
  | 'assets'
  | 'movements'
  | 'inventory'
  | 'audit'
  | 'dashboard';

export interface ExportOptions {
  /** filters / parameters passed to the data provider */
  filters?: Record<string, unknown>;
  /** page size hint for streaming large datasets */
  limit?: number;
  offset?: number;
  /** whether to include a header row (CSV/Excel) */
  includeHeaders?: boolean;
  /** presentation template for PDF (presentation-only); optional */
  template?: import('./report-template.entity').ReportTemplate;
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

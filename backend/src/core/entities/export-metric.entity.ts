/**
 * Export Metric entities — telemetry for the Export Framework (Task T8).
 * Metrics are collected in-memory (no DB schema change). They capture the
 * lifecycle of a single export: duration, rows, output size and outcome.
 * Reference: Task T8 — Enterprise Export Framework.
 */

export type ExportStatus = 'started' | 'completed' | 'failed';

export interface ExportMetric {
  /** correlation id for the export run */
  id: string;
  tenant: string;
  user: string;
  resource: string;
  format: string;
  profile?: string;
  rowsExported: number;
  /** bytes written to the output stream (finalized on stream end) */
  outputSize: number;
  /** elapsed ms (finalized on completion/failure) */
  duration: number;
  success: boolean;
  status: ExportStatus;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ExportMetricSummary {
  total: number;
  successful: number;
  failed: number;
  totalRowsExported: number;
  totalOutputBytes: number;
  averageDurationMs: number;
  byFormat: Record<string, number>;
}

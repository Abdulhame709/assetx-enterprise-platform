/**
 * ExportStrategy port — Strategy Pattern for exporters (Task T8).
 * Each format (csv/xlsx/pdf) is an ExportStrategy. The unified pipeline drives
 * every strategy through the same stages: Prepare → Transform → Format → Write →
 * Stream. This replaces direct format switching in the orchestrator: the caller
 * (ExportService) only ever talks to the pipeline, which selects the strategy.
 *
 * Extension points prepared (NOT implemented): future formats (json, parquet,
 * ods, xml) simply implement this interface and register — no orchestrator change.
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../entities/export.entity';

/** A uniform export row (record of column values). */
export type ExportRow = Record<string, unknown>;

/** Mutable per-run state the strategy carries between its pipeline stages. */
export type ExportStrategyState = Record<string, unknown>;

export interface ExportStrategy {
  readonly format: ExportFormat;

  /** Prepare — allocate/validate resources for a run. */
  prepare(options: ExportOptions): ExportStrategyState | Promise<ExportStrategyState>;

  /** Transform — normalize/shape rows into the format-agnostic export rows. */
  transform(data: ExportRow[], options: ExportOptions): ExportRow[];

  /** Format — build the format-specific structure into the run state. */
  formatOutput(state: ExportStrategyState, rows: ExportRow[], options: ExportOptions): void | Promise<void>;

  /** Write + Stream — return a readable stream for the formatted output. */
  write(state: ExportStrategyState): Readable;

  getMimeType(): string;
  getFileExtension(): string;
}

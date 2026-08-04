/**
 * CsvExportStrategy — CSV exporter (Strategy Pattern, Task T8).
 * CSV streams row-by-row so the Format stage is intentionally a no-op; the
 * streaming happens lazily in Write. Delegates the actual encoding to the
 * existing CsvGenerator (single source of CSV truth).
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../../core/entities/export.entity';
import { ExportRow, ExportStrategy, ExportStrategyState } from '../../../core/ports/export-strategy.port';
import { CsvGenerator } from '../csv.generator';

@Injectable()
export class CsvExportStrategy implements ExportStrategy {
  readonly format: ExportFormat = 'csv';

  constructor(private readonly generator: CsvGenerator) {}

  prepare(options: ExportOptions): ExportStrategyState {
    return { options };
  }

  transform(data: ExportRow[], _options: ExportOptions): ExportRow[] {
    return data;
  }

  formatOutput(state: ExportStrategyState, rows: ExportRow[]): void {
    state.rows = rows;
  }

  write(state: ExportStrategyState): Readable {
    return this.generator.generate(state.rows as unknown[], state.options as ExportOptions | undefined);
  }

  getMimeType(): string { return this.generator.getMimeType(); }
  getFileExtension(): string { return this.generator.getFileExtension(); }
}

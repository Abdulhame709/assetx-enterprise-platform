/**
 * ExcelExportStrategy — XLSX exporter (Strategy Pattern, Task T8).
 * Excel buffers the workbook in Format, then exposes a stream in Write.
 * Delegates the actual encoding to the existing ExcelGenerator.
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../../core/entities/export.entity';
import { ExportRow, ExportStrategy, ExportStrategyState } from '../../../core/ports/export-strategy.port';
import { ExcelGenerator } from '../excel.generator';

@Injectable()
export class ExcelExportStrategy implements ExportStrategy {
  readonly format: ExportFormat = 'xlsx';

  constructor(private readonly generator: ExcelGenerator) {}

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

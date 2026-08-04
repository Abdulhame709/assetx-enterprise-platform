/**
 * PdfExportStrategy — PDF exporter (Strategy Pattern, Task T8).
 * PDF renders the document in Format (via PdfGenerator which consumes the
 * presentation-only ReportTemplate), then exposes a stream in Write.
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../../core/entities/export.entity';
import { ExportRow, ExportStrategy, ExportStrategyState } from '../../../core/ports/export-strategy.port';
import { PdfGenerator } from '../pdf.generator';

@Injectable()
export class PdfExportStrategy implements ExportStrategy {
  readonly format: ExportFormat = 'pdf';

  constructor(private readonly generator: PdfGenerator) {}

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

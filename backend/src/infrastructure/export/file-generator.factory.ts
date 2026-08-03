/**
 * FileGeneratorFactory — picks the correct FileGenerator by format.
 * Centralizes generator selection so ExportService needs no switch statement.
 * Reference: Phase 11.3 (architecture note 3)
 */
import { Injectable } from '@nestjs/common';
import { ExportFormat } from '../../core/entities/export.entity';
import { FileGenerator } from './file-generator.interface';
import { CsvGenerator } from './csv.generator';
import { ExcelGenerator } from './excel.generator';
import { PdfGenerator } from './pdf.generator';

@Injectable()
export class FileGeneratorFactory {
  private readonly generators: Record<ExportFormat, FileGenerator>;

  constructor(
    csv: CsvGenerator,
    excel: ExcelGenerator,
    pdf: PdfGenerator,
  ) {
    this.generators = { csv, xlsx: excel, pdf };
  }

  get(format: ExportFormat): FileGenerator {
    const generator = this.generators[format];
    if (!generator) throw new Error('UNSUPPORTED_EXPORT_FORMAT');
    return generator;
  }
}

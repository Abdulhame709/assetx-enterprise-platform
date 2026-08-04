/**
 * ExcelGenerator — xlsx generation via exceljs (only library allowed).
 * Writes to a buffer internally then exposes a Readable stream.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';

@Injectable()
export class ExcelGenerator implements FileGenerator {
  readonly format: ExportFormat = 'xlsx';

  getMimeType(): string { return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
  getFileExtension(): string { return 'xlsx'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Export');
    const includeHeaders = options?.includeHeaders ?? true;
    const plan = resolveColumnPlan(data, options);
    const headerKeys = plan.keys;
    const headerLabels = plan.labels;

    if (includeHeaders && headerKeys.length > 0) {
      sheet.addRow(headerLabels);
    }
    for (const row of data) {
      const rec = (row ?? {}) as Record<string, unknown>;
      sheet.addRow(headerKeys.map((k) => rec[k] ?? ''));
    }

    const stream = new Readable();
    stream._read = () => {};
    workbook.xlsx.writeBuffer().then((buffer) => {
      stream.push(Buffer.from(buffer));
      stream.push(null);
    }).catch((err) => stream.destroy(err));
    return stream;
  }
}

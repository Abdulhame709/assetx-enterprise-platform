/**
 * CsvGenerator — native CSV generation (no external library), streamed.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';
import { cellText, csvSafe } from './cell-format';
import { bandText, isGroupRow } from '../../core/constants/report-groups';

@Injectable()
export class CsvGenerator implements FileGenerator {
  readonly format: ExportFormat = 'csv';

  getMimeType(): string { return 'text/csv'; }
  getFileExtension(): string { return 'csv'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const includeHeaders = options?.includeHeaders ?? true;
    const plan = resolveColumnPlan(data, options);
    const headerKeys = plan.keys;
    const headerLabels = plan.labels;
    let index = 0;
    let bomSent = false;
    const self = this;

    const stream = new Readable({
      read() {
        if (!bomSent) {
          bomSent = true;
          // UTF-8 BOM so Excel/PDF viewers render Arabic correctly.
          this.push('\uFEFF');
        }
        if (index === 0 && includeHeaders) {
          this.push(self.row(headerLabels));
        }
        if (index < data.length) {
          const row = data[index++];
          // A location band is a line of its own: the name (and count) in the first cell.
          this.push(self.row(isGroupRow(row) ? [bandText(row), ...headerKeys.slice(1).map(() => '')] : self.valuesOf(row, headerKeys)));
        } else {
          this.push(null);
        }
      },
    });
    return stream;
  }

  private valuesOf(obj: unknown, keys: string[]): unknown[] {
    const rec = (obj ?? {}) as Record<string, unknown>;
    return keys.map((k) => rec[k]);
  }

  private row(values: unknown[]): string {
    const escaped = values.map((v) => {
      const s = csvSafe(cellText(v));
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    return `${escaped.join(',')}\n`;
  }
}

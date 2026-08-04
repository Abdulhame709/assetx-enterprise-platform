/**
 * CsvGenerator — native CSV generation (no external library), streamed.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';

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
    const self = this;

    const stream = new Readable({
      read() {
        if (index === 0 && includeHeaders) {
          this.push(self.row(headerLabels));
        }
        if (index < data.length) {
          const row = data[index++];
          this.push(self.row(self.valuesOf(row, headerKeys)));
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
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    return `${escaped.join(',')}\n`;
  }
}

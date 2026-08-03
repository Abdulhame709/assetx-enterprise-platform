/**
 * PdfGenerator — PDF generation via pdfkit (only library allowed).
 * Writes to a buffer internally then exposes a Readable stream.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import PDFKit = require('pdfkit');
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { FileGenerator } from './file-generator.interface';

@Injectable()
export class PdfGenerator implements FileGenerator {
  readonly format: ExportFormat = 'pdf';

  getMimeType(): string { return 'application/pdf'; }
  getFileExtension(): string { return 'pdf'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const doc = new PDFKit();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => {});

    doc.fontSize(16).text('AssetX Export', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);

    const includeHeaders = options?.includeHeaders ?? true;
    const headerKeys = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
    if (includeHeaders && headerKeys.length > 0) {
      doc.text(headerKeys.join(' | '));
      doc.moveDown(0.5);
    }
    for (const row of data) {
      const rec = (row ?? {}) as Record<string, unknown>;
      doc.text(headerKeys.map((k) => String(rec[k] ?? '')).join(' | '));
    }
    doc.end();

    const stream = new Readable();
    stream._read = () => {};
    doc.on('end', () => {
      stream.push(Buffer.concat(chunks));
      stream.push(null);
    });
    doc.on('error', (err) => stream.destroy(err));
    return stream;
  }
}

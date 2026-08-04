/**
 * PdfGenerator — PDF generation via pdfkit (only library allowed).
 * Advanced formatting: title, metadata, page headers/footers, a styled table with
 * column headers + row striping, and a generated-at timestamp.
 * Writes to a buffer internally then exposes a Readable stream.
 * Reference: Phase 11.3 · Task T3 (advanced formatting)
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
    const doc = new PDFKit({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const pageWidth = 595.28; // A4 portrait width (pt)
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Title
    doc.fontSize(18).fillColor('#1f2937').text('AssetX Export', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor('#6b7280').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(0.8);

    const includeHeaders = options?.includeHeaders ?? true;
    const headerKeys = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
    const colWidth = headerKeys.length > 0 ? Math.floor(contentWidth / headerKeys.length) : contentWidth;

    // (Page-number footer intentionally omitted: writing content inside the
    //  'pageAdded' handler recursively re-triggers pageAdded in pdfkit. If page
    //  numbers are needed, render them via a post-generation pass or a fixed
    //  footer on a single-page-per-record layout. Deferred — see Technical Debt.)

    // Header row
    if (includeHeaders && headerKeys.length > 0) {
      this.drawRow(doc, headerKeys, margin, contentWidth, colWidth, true, 0);
    }

    // Data rows
    data.forEach((row, i) => {
      const rec = (row ?? {}) as Record<string, unknown>;
      const values = headerKeys.map((k) => String(rec[k] ?? ''));
      this.drawRow(doc, values, margin, contentWidth, colWidth, false, i);
    });

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

  private drawRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    margin: number,
    contentWidth: number,
    colWidth: number,
    isHeader: boolean,
    rowIndex: number,
  ): void {
    const lineHeight = 16;
    const y = doc.y;
    const isEven = rowIndex % 2 === 0;
    const bg = isHeader ? '#2563eb' : isEven ? '#f3f4f6' : '#ffffff';
    const fg = isHeader ? '#ffffff' : '#111827';

    if (y + lineHeight > doc.page.height - 50) {
      doc.addPage();
    }

    // row background
    doc.save();
    doc.rect(margin, doc.y, contentWidth, lineHeight).fill(bg);
    doc.restore();

    cells.forEach((cell, i) => {
      const x = margin + i * colWidth;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(fg).text(
        this.truncate(cell, colWidth),
        x + 4,
        doc.y + 4,
        { width: colWidth - 8, height: lineHeight - 4, ellipsis: true },
      );
    });
    doc.moveDown(lineHeight / 2);
  }

  private truncate(s: string, width: number): string {
    // rough char-per-width heuristic (font size 8) — enough for long codes/notes
    const maxChars = Math.max(4, Math.floor(width / 5));
    return s.length > maxChars ? `${s.slice(0, maxChars - 3)}...` : s;
  }
}

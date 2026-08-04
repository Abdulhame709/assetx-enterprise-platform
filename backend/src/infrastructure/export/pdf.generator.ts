/**
 * PdfGenerator — PDF generation via pdfkit (only library allowed).
 * Consumes a presentation-only ReportTemplate (Task T6): typography, colors,
 * page orientation/size/margins, table styling, header/footer placeholders,
 * and section ordering. Falls back to a default template when none is provided
 * (backward compatible). ExportService is unchanged.
 * Reference: Phase 11.3 · Task T3/T6
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import PDFKit = require('pdfkit');
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { ReportTemplate } from '../../core/entities/report-template.entity';
import { FileGenerator } from './file-generator.interface';

const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595.28, 841.89], A3: [841.89, 1190.55], LETTER: [612, 792], LEGAL: [612, 1008],
};

@Injectable()
export class PdfGenerator implements FileGenerator {
  readonly format: ExportFormat = 'pdf';

  getMimeType(): string { return 'application/pdf'; }
  getFileExtension(): string { return 'pdf'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const tpl = options?.template;
    const orientation = tpl?.page?.orientation ?? 'portrait';
    const sizeKey = tpl?.page?.size ?? 'A4';
    const [w, h] = PAGE_DIMS[sizeKey] ?? PAGE_DIMS.A4;
    const dims = orientation === 'landscape' ? [h, w] : [w, h];
    const margins = {
      top: tpl?.page?.margins?.top ?? 40,
      right: tpl?.page?.margins?.right ?? 40,
      bottom: tpl?.page?.margins?.bottom ?? 40,
      left: tpl?.page?.margins?.left ?? 40,
    };

    const doc = new PDFKit({ margin: 0, size: [dims[0], dims[1]], margins });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const pageWidth = dims[0];
    const contentWidth = pageWidth - margins.left - margins.right;
    const colors = tpl?.colors ?? {};
    const typo = tpl?.typography ?? {};

    // Ordered sections drive rendering (presentation only).
    // Default to header/body/footer when a template defines no sections.
    const sections = (tpl?.sections && tpl.sections.length > 0
      ? tpl.sections
      : [{ type: 'header', order: 1 }, { type: 'body', order: 2 }, { type: 'footer', order: 3 }]
    ).sort((a, b) => a.order - b.order);
    for (const s of sections) {
      if (s.type === 'header') this.renderHeader(doc, tpl, colors, typo, pageWidth);
      if (s.type === 'body') this.renderBody(doc, data, options, tpl, colors, typo, contentWidth, margins.left);
      if (s.type === 'footer') this.renderFooter(doc, tpl, colors, typo, pageWidth, margins);
    }

    doc.end();

    const stream = new Readable();
    stream._read = () => {};
    doc.on('end', () => { stream.push(Buffer.concat(chunks)); stream.push(null); });
    doc.on('error', (err) => stream.destroy(err));
    return stream;
  }

  private renderHeader(doc: PDFKit.PDFDocument, tpl: ReportTemplate | undefined, colors: NonNullable<ReportTemplate["colors"]>, typo: NonNullable<ReportTemplate["typography"]>, pageWidth: number): void {
    const title = tpl?.header?.title ?? 'AssetX Export';
    const h = tpl?.header;
    if (h?.logoPlaceholder) {
      // FUTURE extension: company logo image rendering
    }
    doc.fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(title, { align: 'center' });
    doc.moveDown(0.2);
    if (h?.showGeneratedAt) {
      doc.fontSize(typo.bodySize ?? 9).fillColor(colors.subtitle ?? '#6b7280')
        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    }
    doc.moveDown(0.8);
    void pageWidth;
  }

  private renderBody(doc: PDFKit.PDFDocument, data: unknown[], options: ExportOptions | undefined, tpl: ReportTemplate | undefined, colors: NonNullable<ReportTemplate["colors"]>, typo: NonNullable<ReportTemplate["typography"]>, contentWidth: number, left: number): void {
    const includeHeaders = options?.includeHeaders ?? true;
    const headerKeys = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
    const colWidth = headerKeys.length > 0 ? Math.floor(contentWidth / headerKeys.length) : contentWidth;
    const table = tpl?.table ?? {};
    const rowHeight = table.rowHeight ?? 16;
    const alternating = table.alternatingRowColors ?? true;

    const drawRow = (cells: string[], isHeader: boolean, rowIndex: number) => {
      if (doc.y + rowHeight > doc.page.height - 50) doc.addPage();
      const bg = isHeader ? (colors.headerBg ?? '#2563eb')
        : (alternating && rowIndex % 2 === 0 ? (colors.rowEven ?? '#f3f4f6') : (colors.rowOdd ?? '#ffffff'));
      doc.save();
      doc.rect(left, doc.y, contentWidth, rowHeight).fill(bg);
      doc.restore();
      cells.forEach((cell, i) => {
        const x = left + i * colWidth;
        const fg = isHeader ? (colors.headerFg ?? '#ffffff') : (colors.title ?? '#111827');
        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(typo.tableSize ?? 8)
          .fillColor(fg).text(this.truncate(cell, colWidth), x + 4, doc.y + 4, { width: colWidth - 8, ellipsis: true });
      });
      doc.moveDown(rowHeight / 2);
    };

    if (includeHeaders && headerKeys.length > 0) drawRow(headerKeys, true, 0);
    data.forEach((row, i) => {
      const rec = (row ?? {}) as Record<string, unknown>;
      drawRow(headerKeys.map((k) => String(rec[k] ?? '')), false, i);
    });
  }

  private renderFooter(doc: PDFKit.PDFDocument, tpl: ReportTemplate | undefined, colors: NonNullable<ReportTemplate["colors"]>, typo: NonNullable<ReportTemplate["typography"]>, pageWidth: number, margins: { bottom: number }): void {
    const text = tpl?.footer?.text;
    if (text) {
      doc.fontSize(typo.footerSize ?? 8).fillColor(colors.subtitle ?? '#9ca3af')
        .text(text, 0, doc.page.height - 20, { align: 'center', width: pageWidth });
    }
    void margins;
  }

  private truncate(s: string, width: number): string {
    const maxChars = Math.max(4, Math.floor(width / 5));
    return s.length > maxChars ? `${s.slice(0, maxChars - 3)}...` : s;
  }
}

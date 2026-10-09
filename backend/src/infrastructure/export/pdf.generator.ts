/**
 * PdfGenerator - PDF generation via pdfkit (only library allowed).
 * Consumes a presentation-only ReportTemplate (Task T6): typography, colors,
 * page orientation/size/margins, table styling, header/footer placeholders,
 * and section ordering. Falls back to a default template when none is provided
 * (backward compatible). ExportService is unchanged.
 * Reference: Phase 11.3 | Task T3/T6
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import PDFKit = require('pdfkit');
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { ReportTemplate } from '../../core/entities/report-template.entity';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';

const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595.28, 841.89], A3: [841.89, 1190.55], LETTER: [612, 792], LEGAL: [612, 1008],
};

/** Embedded Arabic fonts (Amiri, SIL Open Font License 1.1) so exported PDFs
 *  render Arabic text correctly. PDFKit's built-in Helvetica has no Arabic
 *  glyphs. Files live under backend/assets/fonts (installed by the fix script). */
const ARABIC_FONT = path.resolve(__dirname, '../../../assets/fonts/Amiri-Regular.ttf');
const ARABIC_FONT_BOLD = path.resolve(__dirname, '../../../assets/fonts/Amiri-Bold.ttf');
const FONT_ARABIC = 'AssetXArabic';
const FONT_ARABIC_BOLD = 'AssetXArabicBold';

function arabicFontsAvailable(): boolean {
  return fs.existsSync(ARABIC_FONT) && fs.existsSync(ARABIC_FONT_BOLD);
}

/**
 * Arabic (RTL) visual-order conversion for PDFKit.
 *
 * PDFKit asks fontkit to lay out each whitespace-delimited word separately and
 * then places those words left-to-right in the order they appear in the input
 * string. fontkit itself shapes Arabic letters correctly (contextual forms and
 * letter order inside a word), so individual words render fine — but the WORD
 * ORDER of a multi-word Arabic line stays left-to-right, i.e. mirrored for the
 * reader.
 *
 * This converter therefore only reverses the order of the whitespace-delimited
 * tokens of a line that contains Arabic, keeping every letter in its original
 * logical order so fontkit can still shape it. Latin words, digits and
 * punctuation attached to a word (":", "|", "-", ...) move with it, which is
 * exactly how the bidi algorithm places them for an RTL line.
 */
const ARABIC_RANGE = /[\u0600-\u06FF]/;

/** Reorder tokens of an RTL line into visual (drawing) order for PDFKit. */
function rtlDisplayOrder(text: string): string {
  if (!text || !ARABIC_RANGE.test(text)) return text;
  return text.split(/(\s+)/).reverse().join('');
}

function measureCellUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ARABIC_RANGE.test(ch) || code === 0x20) units += ch === ' ' ? 0.35 : 1.0;
    else if (/[0-9]/.test(ch)) units += 0.55;
    else if (/[.,:;|\-@/]/.test(ch)) units += 0.4;
    else if (/[A-Z]/.test(ch)) units += 0.8;
    else units += 0.6;
  }
  return units;
}

/** Distribute the available table width between columns proportionally to the
 *  widest value in each column (header included). Long text columns (asset
 *  name, location, notes) get more space; numeric/id columns get less, and a
 *  single column can never swallow the whole table. Columns whose data cells
 *  are all empty are shrunk to a slim width that still fits the Arabic header
 *  (wrapped to two lines if needed) instead of reserving a full column. */
function distributeTableWidths(headers: string[], rows: unknown[], keys: string[], total: number): number[] {
  if (keys.length === 0) return [total];
  const widths: number[] = [];
  let sum = 0;
  for (let i = 0; i < keys.length; i += 1) {
    let maxUnits = measureCellUnits(headers[i] ?? keys[i]);
    let allEmpty = true;
    for (const row of rows) {
      const value = String((row as Record<string, unknown>)?.[keys[i]] ?? '');
      const units = measureCellUnits(value);
      if (units > maxUnits) maxUnits = units;
      if (value.trim() !== '') allEmpty = false;
    }
    // Empty columns: reserve roughly the header width (wrapping allowed),
    // never a content-filled share.
    const weighted = allEmpty
      ? Math.max(3, Math.min(maxUnits * 0.55 + 1, 14))
      : Math.max(2, Math.min(maxUnits + 1.5, 45));
    widths.push(weighted);
    sum += weighted;
  }
  const minCol = Math.max(10, Math.round(total * 0.03));
  const maxCol = Math.round(total * 0.38);
  const distributed = widths.map((w) => Math.max(minCol, Math.min(maxCol, Math.round(total * w / sum))));
  // Round-off: absorb the leftover so the columns exactly fill the table.
  let diff = total - distributed.reduce((a, b) => a + b, 0);
  let cursor = 0;
  let guard = 0;
  while (diff !== 0 && guard < 5000) {
    const idx = cursor % distributed.length;
    const step = diff > 0 ? 1 : -1;
    const next = distributed[idx] + step;
    if (next >= minCol && next <= maxCol && Math.abs(diff) > 0) {
      distributed[idx] = next;
      diff -= step;
    }
    cursor += 1;
    guard += 1;
  }
  return distributed;
}

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

    // Use the embedded Arabic font when available (Arabic + Latin coverage).
    if (arabicFontsAvailable()) {
      doc.registerFont(FONT_ARABIC, ARABIC_FONT);
      doc.registerFont(FONT_ARABIC_BOLD, ARABIC_FONT_BOLD);
      doc.font(FONT_ARABIC);
    } else {
      doc.font('Helvetica');
    }

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
    const titleFont = arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica';
    doc.font(titleFont).fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(rtlDisplayOrder(title), { align: 'center' });
    doc.moveDown(0.2);
    if (h?.showGeneratedAt) {
      doc.font(titleFont).fontSize(typo.bodySize ?? 9).fillColor(colors.subtitle ?? '#6b7280')
        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    }
    doc.moveDown(0.8);
    void pageWidth;
  }

  private renderBody(doc: PDFKit.PDFDocument, data: unknown[], options: ExportOptions | undefined, tpl: ReportTemplate | undefined, colors: NonNullable<ReportTemplate["colors"]>, typo: NonNullable<ReportTemplate["typography"]>, contentWidth: number, left: number): void {
    const includeHeaders = options?.includeHeaders ?? true;
    const plan = resolveColumnPlan(data, options);
    const headerKeys = plan.keys;
    const headerLabels = plan.labels;
    const table = tpl?.table ?? {};
    const rowHeight = table.rowHeight ?? 16;
    const alternating = table.alternatingRowColors ?? true;
    // Column widths adapt to the content: wide for names/locations/notes,
    // narrow for quantities/codes — never a single fixed split.
    const colWidths = distributeTableWidths(headerLabels, data, headerKeys, contentWidth);

    const drawRow = (cells: string[], isHeader: boolean, rowIndex: number) => {
      let rowHeightCur = rowHeight;
      if (doc.y + rowHeightCur > doc.page.height - 50) doc.addPage();
      const rowTop = doc.y;
      const bg = isHeader ? (colors.headerBg ?? '#2563eb')
        : (alternating && rowIndex % 2 === 0 ? (colors.rowEven ?? '#f3f4f6') : (colors.rowOdd ?? '#ffffff'));
      doc.save();
      doc.rect(left, rowTop, contentWidth, rowHeightCur).fill(bg);
      doc.restore();
      cells.forEach((cell, i) => {
        const colWidth = colWidths[i] ?? colWidths[colWidths.length - 1] ?? contentWidth;
        const x = left + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        const fg = isHeader ? (colors.headerFg ?? '#ffffff') : (colors.title ?? '#111827');
        // Anchor every cell to the same baseline; doc.text() advances doc.y,
        // so we must NOT use doc.y inside the loop (caused diagonal stacking).
        // Arabic cells use rtlDisplayOrder() which reorders only the words
        // (fontkit shapes each word correctly), keeping Latin text in place.
        const display = rtlDisplayOrder(cell);
        const fontName = isHeader
          ? (arabicFontsAvailable() ? FONT_ARABIC_BOLD : 'Helvetica-Bold')
          : (arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica');
        // Row height grows when a cell needs more than one line (heightOfString
        // returns a height in points, so it can be used directly).
        if (!isHeader) {
          const usedHeight = doc.font(fontName).fontSize(typo.tableSize ?? 8).heightOfString(display, { width: colWidth - 8 }) + 4;
          rowHeightCur = Math.max(rowHeightCur, usedHeight);
        }
        doc.font(fontName).fontSize(typo.tableSize ?? 8)
          .fillColor(fg).text(display, x + 4, rowTop + 4, { width: colWidth - 8 });
      });
      // Set doc.y directly (moveDown() counts in lines, not points, which
      // caused huge gaps between rows).
      doc.y = rowTop + rowHeightCur + 2;
    };

    if (includeHeaders && headerKeys.length > 0) drawRow(headerLabels, true, 0);
    data.forEach((row, i) => {
      const rec = (row ?? {}) as Record<string, unknown>;
      drawRow(headerKeys.map((k) => String(rec[k] ?? '')), false, i);
    });
  }

  private renderFooter(doc: PDFKit.PDFDocument, tpl: ReportTemplate | undefined, colors: NonNullable<ReportTemplate["colors"]>, typo: NonNullable<ReportTemplate["typography"]>, pageWidth: number, margins: { bottom: number }): void {
    const text = tpl?.footer?.text;
    if (text) {
      doc.font(arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica')
        .fontSize(typo.footerSize ?? 8).fillColor(colors.subtitle ?? '#9ca3af')
        .text(rtlDisplayOrder(text), 0, doc.page.height - 20, { align: 'center', width: pageWidth });
    }
    void margins;
  }

  private truncate(s: string, width: number): string {
    const maxChars = Math.max(4, Math.floor(width / 5));
    return s.length > maxChars ? `${s.slice(0, maxChars - 3)}...` : s;
  }
}

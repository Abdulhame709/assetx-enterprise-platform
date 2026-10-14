/**
 * PdfGenerator - PDF generation via pdfkit (only library allowed).
 *
 * Produces an ERP-style report: organization header (logo, name, title, filters,
 * issue date) repeated on every page, a repeating table header, zebra rows,
 * a totals row, "page X of Y" footer, optional AI summary, signature block and
 * draft watermark. Arabic is the primary language: with meta.dir === 'rtl' the
 * columns run right to left, text is right aligned and numbers use Latin digits
 * with thousands separators.
 *
 * It consumes a presentation-only ReportTemplate (Task T6) for page size,
 * orientation, margins, fonts sizes and colors; every value has a sober default.
 * Reference: Phase 11.3 | Task T3/T6
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import PDFKit = require('pdfkit');
import { ExportFormat, ExportMeta, ExportOptions } from '../../core/entities/export.entity';
import { ColorPalette } from '../../core/entities/report-template.entity';
import { MONEY_KEYS, REPORT_TEXT } from '../../core/constants/export-labels';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';
import { columnTotals, displayText, formatNumber, isNumericColumn } from './cell-format';
import { BaseDirection, visualSegments } from './rtl-text';

const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595.28, 841.89], A3: [841.89, 1190.55], LETTER: [612, 792], LEGAL: [612, 1008],
};

/** Embedded fonts (SIL Open Font License) so exported PDFs render Arabic
 *  correctly. PDFKit's built-in Helvetica has no Arabic glyphs. Files live under
 *  backend/assets/fonts (copied into the Docker image). */
const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const FONT_CANDIDATES = [
  ['IBMPlexSansArabic-Regular.ttf', 'IBMPlexSansArabic-Bold.ttf'],
  ['Amiri-Regular.ttf', 'Amiri-Bold.ttf'],
];
const FONT_ARABIC = 'AssetXArabic';
const FONT_ARABIC_BOLD = 'AssetXArabicBold';

function findFonts(): { regular: string; bold: string } | undefined {
  for (const [regular, bold] of FONT_CANDIDATES) {
    const r = path.join(FONT_DIR, regular);
    const b = path.join(FONT_DIR, bold);
    if (fs.existsSync(r) && fs.existsSync(b)) return { regular: r, bold: b };
  }
  return undefined;
}

/** Sober ERP palette; a template can override any of it. */
const PALETTE = {
  primary: '#1f3a5f', headerFg: '#ffffff', rowEven: '#f6f8fb', rowOdd: '#ffffff', text: '#111827',
  muted: '#64748b', border: '#dbe2ea', totalBg: '#e6edf5', accent: '#b91c1c', summaryBg: '#f1f5f9',
};

const ARABIC_RANGE = /[؀-ۿ]/;

/** Approximate glyph width (in "units") used only to share the table width
 *  between columns; real wrapping uses exact measurements. */
function measureCellUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    if (ARABIC_RANGE.test(ch)) units += 1.0;
    else if (ch === ' ') units += 0.35;
    else if (/[0-9]/.test(ch)) units += 0.55;
    else if (/[.,:;|\-@/]/.test(ch)) units += 0.4;
    else if (/[A-Z]/.test(ch)) units += 0.8;
    else units += 0.6;
  }
  return units;
}

/** Distribute the table width between columns proportionally to the widest
 *  value in each column (header included). Long text columns get more space;
 *  numeric/id columns get less and one column can never swallow the table.
 *  Columns whose data cells are all empty shrink to a slim width. */
function distributeTableWidths(headers: string[], columnTexts: string[][], total: number): number[] {
  const count = headers.length;
  if (count === 0) return [total];
  const widths: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    let maxUnits = measureCellUnits(headers[i] ?? '');
    let allEmpty = true;
    for (const value of columnTexts[i]) {
      const units = measureCellUnits(value);
      if (units > maxUnits) maxUnits = units;
      if (value.trim() !== '') allEmpty = false;
    }
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
    if (next >= minCol && next <= maxCol) {
      distributed[idx] = next;
      diff -= step;
    }
    cursor += 1;
    guard += 1;
  }
  return distributed;
}

type Side = 'left' | 'right' | 'center';

interface DrawOptions {
  x: number; width: number; baseline: number; side: Side; bold?: boolean; size: number; color: string;
}

/** Text measuring, wrapping and bidi-aware drawing on top of a PDFKit document. */
class Painter {
  private readonly memo = new Map<string, number>();
  private current = '';

  constructor(
    readonly doc: PDFKit.PDFDocument,
    readonly base: BaseDirection,
    private readonly regular: string,
    private readonly bold: string,
  ) {}

  private fontName(bold?: boolean): string { return bold ? this.bold : this.regular; }

  private width(text: string, bold: boolean | undefined, size: number): number {
    const font = this.fontName(bold);
    const key = `${font}|${size}|${text}`;
    const cached = this.memo.get(key);
    if (cached !== undefined) return cached;
    if (this.current !== font) { this.doc.font(font); this.current = font; }
    const w = this.doc.fontSize(size).widthOfString(text);
    this.memo.set(key, w);
    return w;
  }

  lineWidth(text: string, bold: boolean | undefined, size: number): number {
    let total = 0;
    for (const segment of visualSegments(text, this.base)) total += this.width(segment, bold, size);
    return total;
  }

  /** Break text into lines that fit `maxWidth` (words never split unless one is wider than the box). */
  wrap(text: string, bold: boolean | undefined, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) { lines.push(''); continue; }
      let line = '';
      const flush = () => { if (line) { lines.push(line); line = ''; } };
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.lineWidth(candidate, bold, size) <= maxWidth) { line = candidate; continue; }
        flush();
        if (this.lineWidth(word, bold, size) <= maxWidth) { line = word; continue; }
        // A single token wider than the box (long code / URL): break by characters.
        let piece = '';
        for (const ch of Array.from(word)) {
          if (piece && this.lineWidth(piece + ch, bold, size) > maxWidth) { lines.push(piece); piece = ch; }
          else piece += ch;
        }
        line = piece;
      }
      flush();
    }
    return lines.length > 0 ? lines : [''];
  }

  /** Vertical distance from a text box top to its baseline for the current font. */
  private ascent(bold: boolean | undefined, size: number): number {
    const font = this.fontName(bold);
    if (this.current !== font) { this.doc.font(font); this.current = font; }
    const f = (this.doc as unknown as { _font?: { ascender?: number } })._font;
    return ((f?.ascender ?? 900) / 1000) * size;
  }

  draw(text: string, o: DrawOptions): void {
    if (!text) return;
    const segments = visualSegments(text, this.base);
    const total = segments.reduce((sum, s) => sum + this.width(s, o.bold, o.size), 0);
    let x: number;
    if (o.side === 'right') x = o.x + o.width - total;
    else if (o.side === 'center') x = o.x + (o.width - total) / 2;
    else x = o.x;
    const y = o.baseline - this.ascent(o.bold, o.size);
    this.doc.fillColor(o.color);
    for (const segment of segments) {
      this.doc.font(this.fontName(o.bold)).fontSize(o.size).text(segment, x, y, { lineBreak: false });
      this.current = this.fontName(o.bold);
      x += this.width(segment, o.bold, o.size);
    }
  }
}

function stamp(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

@Injectable()
export class PdfGenerator implements FileGenerator {
  readonly format: ExportFormat = 'pdf';

  getMimeType(): string { return 'application/pdf'; }
  getFileExtension(): string { return 'pdf'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const tpl = options?.template;
    const meta: ExportMeta | undefined = options?.meta;
    const lang = meta?.lang === 'en' ? 'en' : 'ar';
    const ui = REPORT_TEXT[lang];
    const rtl = (meta?.dir ?? 'ltr') === 'rtl';
    const base: BaseDirection = rtl ? 'rtl' : 'ltr';

    const plan = resolveColumnPlan(data, options);
    const includeHeaders = options?.includeHeaders ?? true;

    // Page geometry: an explicit template wins; otherwise wide reports go landscape.
    const wide = plan.keys.length > 7;
    const orientation = tpl?.page?.orientation
      ?? ((meta?.orientation === 'landscape' || (meta?.orientation === 'auto' && wide)) ? 'landscape' : 'portrait');
    const [w, h] = PAGE_DIMS[tpl?.page?.size ?? 'A4'] ?? PAGE_DIMS.A4;
    const [pageW, pageH] = orientation === 'landscape' ? [h, w] : [w, h];
    const margins = {
      top: tpl?.page?.margins?.top ?? 36,
      right: tpl?.page?.margins?.right ?? 36,
      bottom: Math.max(tpl?.page?.margins?.bottom ?? 36, 34),
      left: tpl?.page?.margins?.left ?? 36,
    };

    const doc = new PDFKit({
      margin: 0, size: [pageW, pageH], margins, bufferPages: true,
      info: { Title: meta?.title ?? tpl?.header?.title ?? 'AssetX Export', Author: meta?.organizationName ?? 'AssetX' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const fonts = findFonts();
    let regular = 'Helvetica';
    let bold = 'Helvetica-Bold';
    if (fonts) {
      doc.registerFont(FONT_ARABIC, fonts.regular);
      doc.registerFont(FONT_ARABIC_BOLD, fonts.bold);
      regular = FONT_ARABIC;
      bold = FONT_ARABIC_BOLD;
    }
    const painter = new Painter(doc, base, regular, bold);

    const colors: ColorPalette = tpl?.colors ?? {};
    const pal = {
      primary: colors.headerBg ?? PALETTE.primary,
      headerFg: colors.headerFg ?? PALETTE.headerFg,
      rowEven: colors.rowEven ?? PALETTE.rowEven,
      rowOdd: colors.rowOdd ?? PALETTE.rowOdd,
      text: PALETTE.text,
      muted: colors.subtitle ?? PALETTE.muted,
    };
    const typo = tpl?.typography ?? {};
    const tableSize = typo.tableSize ?? 9;
    const bodySize = typo.bodySize ?? 9;
    const titleSize = typo.titleSize ?? 17;
    const footerSize = typo.footerSize ?? 8;
    const alternating = tpl?.table?.alternatingRowColors ?? true;
    const minRowHeight = tpl?.table?.rowHeight ?? 0;

    const left = margins.left;
    const contentWidth = pageW - margins.left - margins.right;
    const start: Side = rtl ? 'right' : 'left';
    const end: Side = rtl ? 'left' : 'right';
    const limit = pageH - margins.bottom - 6;
    const padX = 5;
    const padY = 3;
    const pitch = tableSize * 1.5;

    const title = meta?.title ?? tpl?.header?.title ?? 'AssetX Export';
    const organization = meta?.organizationName ?? 'AssetX';
    const stampText = stamp(meta?.generatedAt);

    // ---- logo (optional, never fatal) ------------------------------------
    const logoSize = 38;
    const drawLogo = (x: number, y: number, size: number): boolean => {
      if (!meta?.logo) return false;
      try { doc.image(meta.logo, x, y, { fit: [size, size], align: 'center', valign: 'center' }); return true; } catch { return false; }
    };

    const rule = (y: number, thickness: number, color: string) => {
      doc.save().lineWidth(thickness).strokeColor(color).moveTo(left, y).lineTo(left + contentWidth, y).stroke().restore();
    };

    // ---- page headers ------------------------------------------------------
    /** Full header for the first page. Returns the y where the body starts. */
    const drawFirstHeader = (): number => {
      let y = margins.top;
      const hasLogo = drawLogoAt(y);
      const textBox = hasLogo ? contentWidth * 0.55 - logoSize - 10 : contentWidth * 0.55;
      const textX = rtl ? left + contentWidth - (hasLogo ? logoSize + 10 : 0) - textBox : left + (hasLogo ? logoSize + 10 : 0);
      painter.draw(organization, { x: textX, width: textBox, baseline: y + 18, side: start, bold: true, size: 13, color: pal.primary });
      if (meta?.resource || meta?.title) {
        painter.draw(`${ui.rowsCount}: ${formatNumber(data.length)}`, { x: textX, width: textBox, baseline: y + 33, side: start, size: 8.5, color: pal.muted });
      }
      // issue date + user on the opposite side
      const infoW = contentWidth * 0.4;
      const infoX = rtl ? left : left + contentWidth - infoW;
      painter.draw(`${ui.generatedAt}: ${stampText}`, { x: infoX, width: infoW, baseline: y + 14, side: end, size: 8.5, color: pal.muted });
      if (meta?.userName) painter.draw(`${ui.generatedBy}: ${meta.userName}`, { x: infoX, width: infoW, baseline: y + 28, side: end, size: 8.5, color: pal.muted });
      y += 46;
      rule(y, 1.4, pal.primary);
      y += 14;
      // title
      painter.draw(title, { x: left, width: contentWidth, baseline: y + titleSize, side: 'center', bold: true, size: titleSize, color: pal.text });
      y += titleSize * 1.5 + 4;
      if (meta?.filtersText) {
        const lines = painter.wrap(meta.filtersText, false, 8.5, contentWidth - 40).slice(0, 2);
        for (const line of lines) {
          painter.draw(line, { x: left, width: contentWidth, baseline: y + 9, side: 'center', size: 8.5, color: pal.muted });
          y += 13;
        }
      }
      y += 6;
      if (meta?.summary) y = drawSummary(y);
      return y;
    };

    function drawLogoAt(y: number): boolean {
      const x = rtl ? left + contentWidth - logoSize : left;
      return drawLogo(x, y, logoSize);
    }

    const drawSummary = (top: number): number => {
      const boxPad = 8;
      const inner = contentWidth - boxPad * 2 - 6;
      const all = painter.wrap(meta?.summary ?? '', false, bodySize, inner);
      const lines = all.length > 8 ? [...all.slice(0, 7), `${all[7].replace(/\s+\S*$/, '')} …`] : all;
      const lineH = bodySize * 1.5;
      const height = boxPad * 2 + lineH * (lines.length + 1);
      doc.save().rect(left, top, contentWidth, height).fill(PALETTE.summaryBg).restore();
      const barX = rtl ? left + contentWidth - 3 : left;
      doc.save().rect(barX, top, 3, height).fill(pal.primary).restore();
      const textX = left + (rtl ? boxPad : boxPad + 3);
      painter.draw(ui.summary, { x: textX, width: inner, baseline: top + boxPad + lineH * 0.75, side: start, bold: true, size: bodySize, color: pal.primary });
      lines.forEach((line, i) => {
        painter.draw(line, { x: textX, width: inner, baseline: top + boxPad + lineH * (i + 1) + lineH * 0.75, side: start, size: bodySize, color: pal.text });
      });
      return top + height + 10;
    };

    /** Slim header for pages 2+. Returns the y where the body starts. */
    const drawCompactHeader = (): number => {
      const y = margins.top;
      painter.draw(organization, { x: left, width: contentWidth * 0.5, baseline: y + 12, side: start, bold: true, size: 10, color: pal.primary });
      painter.draw(title, { x: left + contentWidth * 0.5, width: contentWidth * 0.5, baseline: y + 12, side: end, size: 10, color: pal.muted });
      rule(y + 20, 0.8, pal.primary);
      return y + 30;
    };

    // ---- table ----------------------------------------------------------------
    const keys = plan.keys;
    const labels = plan.labels;
    const rows = data.map((row) => (row ?? {}) as Record<string, unknown>);
    const cells: string[][] = rows.map((rec) => keys.map((k) => displayText(k, rec[k])));
    const numeric = keys.map((k) => isNumericColumn(k, rows));
    const totals = columnTotals(keys, rows);
    const hasTotals = rows.length > 0 && Object.keys(totals).length > 0;
    const totalCells = keys.map((k, i) => {
      if (totals[k] !== undefined) return formatNumber(totals[k], MONEY_KEYS.has(k) ? 2 : undefined);
      return i === 0 ? ui.total : '';
    });

    const columnTexts = keys.map((_, i) => cells.map((r) => r[i]));
    if (hasTotals) columnTexts.forEach((col, i) => col.push(totalCells[i]));
    const colWidths = distributeTableWidths(labels, columnTexts, contentWidth);
    // Visual order: first logical column sits at the right edge for RTL.
    const order = keys.map((_, i) => i);
    if (rtl) order.reverse();
    const colX: number[] = new Array(keys.length);
    let acc = left;
    for (const i of order) { colX[i] = acc; acc += colWidths[i]; }

    let y = drawFirstHeader();

    const newPage = () => {
      doc.addPage();
      y = drawCompactHeader();
    };

    type RowKind = 'header' | 'body' | 'total';
    const drawRow = (texts: string[], kind: RowKind, index: number): void => {
      const isBold = kind !== 'body';
      const wrapped = texts.map((t, i) => painter.wrap(t, isBold, tableSize, colWidths[i] - padX * 2));
      const lineCount = Math.max(1, ...wrapped.map((l) => l.length));
      const rowH = Math.max(minRowHeight, lineCount * pitch + padY * 2);
      if (y > margins.top + 40 && y + rowH > limit) {
        newPage();
        if (kind === 'body' || kind === 'total') if (includeHeaders && keys.length > 0) drawRow(labels, 'header', 0);
      }
      const top = y;
      const bg = kind === 'header' ? pal.primary
        : kind === 'total' ? PALETTE.totalBg
          : (alternating && index % 2 === 0 ? pal.rowEven : pal.rowOdd);
      doc.save().rect(left, top, contentWidth, rowH).fill(bg).restore();
      doc.save().lineWidth(kind === 'total' ? 0.9 : 0.4).strokeColor(kind === 'total' ? pal.primary : PALETTE.border)
        .moveTo(left, kind === 'total' ? top : top + rowH).lineTo(left + contentWidth, kind === 'total' ? top : top + rowH).stroke().restore();
      const fg = kind === 'header' ? pal.headerFg : pal.text;
      for (let i = 0; i < keys.length; i += 1) {
        const side: Side = numeric[i] ? end : start;
        wrapped[i].forEach((line, k) => {
          painter.draw(line, {
            x: colX[i] + padX, width: colWidths[i] - padX * 2, side, bold: isBold, size: tableSize, color: fg,
            baseline: top + padY + k * pitch + pitch / 2 + tableSize * 0.35,
          });
        });
      }
      y = top + rowH;
    };

    if (keys.length > 0) {
      if (includeHeaders) drawRow(labels, 'header', 0);
      if (rows.length === 0) {
        const emptyH = 40;
        doc.save().rect(left, y, contentWidth, emptyH).fill(pal.rowOdd).restore();
        painter.draw(ui.noData, { x: left, width: contentWidth, baseline: y + emptyH / 2 + 4, side: 'center', size: bodySize, color: pal.muted });
        y += emptyH;
      }
      cells.forEach((row, i) => drawRow(row, 'body', i));
      if (hasTotals) drawRow(totalCells, 'total', 0);
    }
    rule(y, 0.9, pal.primary);
    y += 10;

    // ---- signatures (optional) ------------------------------------------------
    if (meta?.signatures) {
      const blockH = 78;
      if (y + blockH > limit) newPage();
      const labelsSig = [ui.preparedBy, ui.reviewedBy, ui.approvedBy];
      const slotW = contentWidth / labelsSig.length;
      const slots = rtl ? [...labelsSig] : labelsSig; // first label at the start edge
      slots.forEach((label, i) => {
        const x = rtl ? left + contentWidth - slotW * (i + 1) : left + slotW * i;
        painter.draw(label, { x, width: slotW, baseline: y + 10, side: 'center', bold: true, size: bodySize, color: pal.text });
        doc.save().lineWidth(0.6).strokeColor(PALETTE.muted).moveTo(x + 24, y + 52).lineTo(x + slotW - 24, y + 52).stroke().restore();
        painter.draw(`${ui.signature} / ${ui.date}`, { x, width: slotW, baseline: y + 66, side: 'center', size: 7.5, color: pal.muted });
      });
      y += blockH;
    }

    // ---- footer + watermark on every page (needs the final page count) ----------
    const range = doc.bufferedPageRange();
    const showPageNumbers = tpl?.footer?.showPageNumbers ?? true;
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const footerTop = pageH - margins.bottom + 6;
      doc.save().lineWidth(0.5).strokeColor(PALETTE.border).moveTo(left, footerTop).lineTo(left + contentWidth, footerTop).stroke().restore();
      const baseline = footerTop + 13;
      const third = contentWidth / 3;
      if (showPageNumbers) {
        const pageText = `${ui.page} ${i + 1} ${ui.of} ${range.count}`;
        painter.draw(pageText, { x: rtl ? left : left + third * 2, width: third, baseline, side: end, size: footerSize, color: pal.muted });
      }
      if (tpl?.footer?.text) painter.draw(tpl.footer.text, { x: left + third, width: third, baseline, side: 'center', size: footerSize, color: pal.muted });
      painter.draw(organization, { x: rtl ? left + third * 2 : left, width: third, baseline, side: start, size: footerSize, color: pal.muted });

      if (meta?.draft) {
        const cx = pageW / 2;
        const cy = pageH / 2;
        doc.save();
        doc.opacity(0.08);
        doc.rotate(-35, { origin: [cx, cy] });
        painter.draw(ui.draft, { x: cx - 250, width: 500, baseline: cy + 40, side: 'center', bold: true, size: 130, color: PALETTE.accent });
        doc.restore();
      }
    }

    doc.end();

    const stream = new Readable();
    stream._read = () => {};
    doc.on('end', () => { stream.push(Buffer.concat(chunks)); stream.push(null); });
    doc.on('error', (err) => stream.destroy(err));
    return stream;
  }
}

/**
 * ExcelGenerator — xlsx generation via exceljs (only library allowed).
 * Writes to a buffer internally then exposes a Readable stream.
 *
 * With report meta the sheet gets an organization/title block, a styled and
 * frozen header row, auto filter, auto column widths, real numbers and dates
 * (with number formats), a SUM totals row and print setup. Arabic reports use a
 * right-to-left sheet. Without meta the output stays a plain table.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';
import { ADDITIVE_KEYS, MONEY_KEYS, NUMERIC_KEYS, REPORT_TEXT } from '../../core/constants/export-labels';
import { FileGenerator } from './file-generator.interface';
import { resolveColumnPlan } from './column-plan';
import { cellText, numericValue } from './cell-format';

const NAVY = 'FF1F3A5F';
const BORDER = { style: 'thin' as const, color: { argb: 'FFDBE2EA' } };
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

interface Prepared { value: ExcelJS.CellValue; numFmt?: string; numeric: boolean }

function columnLetter(index: number): string {
  let n = index;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Real numbers and dates instead of text so the sheet can be summed/filtered. */
function prepare(key: string, raw: unknown): Prepared {
  if (raw instanceof Date) return { value: raw, numFmt: 'yyyy-mm-dd hh:mm', numeric: false };
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { value: raw, numFmt: MONEY_KEYS.has(key) ? '#,##0.00' : (Number.isInteger(raw) ? '#,##0' : '#,##0.##'), numeric: true };
  }
  if (typeof raw === 'string') {
    if (NUMERIC_KEYS.has(key)) {
      const n = numericValue(raw);
      if (n !== null) return { value: n, numFmt: MONEY_KEYS.has(key) ? '#,##0.00' : (Number.isInteger(n) ? '#,##0' : '#,##0.##'), numeric: true };
    }
    let m = DATE_ONLY.exec(raw);
    if (m) return { value: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), numFmt: 'yyyy-mm-dd', numeric: false };
    m = DATE_TIME.exec(raw);
    if (m) return { value: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))), numFmt: 'yyyy-mm-dd hh:mm', numeric: false };
  }
  return { value: cellText(raw), numeric: false };
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Export').slice(0, 31);
}

@Injectable()
export class ExcelGenerator implements FileGenerator {
  readonly format: ExportFormat = 'xlsx';

  getMimeType(): string { return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
  getFileExtension(): string { return 'xlsx'; }

  generate(data: unknown[], options?: ExportOptions): Readable {
    const meta = options?.meta;
    const lang = meta?.lang === 'en' ? 'en' : 'ar';
    const ui = REPORT_TEXT[lang];
    const rtl = (meta?.dir ?? 'ltr') === 'rtl';
    const includeHeaders = options?.includeHeaders ?? true;
    const plan = resolveColumnPlan(data, options);
    const keys = plan.keys;
    const labels = plan.labels;
    const columnCount = keys.length;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = meta?.organizationName ?? 'AssetX';
    if (meta?.title) workbook.title = meta.title;
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(safeSheetName(meta ? (meta.title ?? ui.sheet) : 'Export'), {
      views: [{ rightToLeft: rtl, showGridLines: !meta }],
    });
    const textAlign = rtl ? 'right' : 'left';
    const numberAlign = rtl ? 'left' : 'right';

    // ---- title block (only for reports that carry meta) -------------------
    if (meta && columnCount > 0) {
      const lines: { text: string; font: Partial<ExcelJS.Font> }[] = [];
      if (meta.organizationName) lines.push({ text: meta.organizationName, font: { bold: true, size: 14, color: { argb: NAVY } } });
      lines.push({ text: meta.title ?? ui.sheet, font: { bold: true, size: 12 } });
      if (meta.filtersText) lines.push({ text: meta.filtersText, font: { size: 9, color: { argb: 'FF64748B' } } });
      const stamp = meta.generatedAt ? new Date(meta.generatedAt) : new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const when = `${stamp.getFullYear()}-${p(stamp.getMonth() + 1)}-${p(stamp.getDate())} ${p(stamp.getHours())}:${p(stamp.getMinutes())}`;
      lines.push({
        text: `${ui.generatedAt}: ${when}${meta.userName ? `   |   ${ui.generatedBy}: ${meta.userName}` : ''}`,
        font: { size: 9, color: { argb: 'FF64748B' } },
      });
      for (const line of lines) {
        const row = sheet.addRow([line.text]);
        if (columnCount > 1) sheet.mergeCells(row.number, 1, row.number, columnCount);
        const cell = row.getCell(1);
        cell.font = line.font;
        cell.alignment = { horizontal: textAlign, vertical: 'middle' };
        row.height = line.font.size && line.font.size > 11 ? 22 : 16;
      }
      sheet.addRow([]);
    }

    // ---- header row ---------------------------------------------------------
    let headerRowNumber = 0;
    if (includeHeaders && columnCount > 0) {
      const row = sheet.addRow(labels);
      headerRowNumber = row.number;
      row.height = 24;
      row.eachCell((cell) => {
        if (meta) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
        } else {
          cell.font = { bold: true };
        }
      });
    }

    // ---- data rows ------------------------------------------------------------
    const widths: number[] = labels.map((l) => Math.min(Math.max(String(l).length + 4, 10), 40));
    const firstData = sheet.rowCount + 1;
    const numericColumn: boolean[] = keys.map(() => false);
    data.forEach((raw, rowIndex) => {
      const rec = (raw ?? {}) as Record<string, unknown>;
      const prepared = keys.map((k) => {
        const c = prepare(k, rec[k]);
        // A blank text value prints as "-" (the field form keeps empty cells to write in).
        if (meta && !meta.formMode && c.value === '' && !NUMERIC_KEYS.has(k)) return { ...c, value: '-' };
        return c;
      });
      const row = sheet.addRow(prepared.map((c) => c.value));
      if (meta?.formMode) row.height = 26;
      prepared.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.numFmt) cell.numFmt = c.numFmt;
        if (c.numeric) numericColumn[i] = true;
        const text = c.value instanceof Date ? 'yyyy-mm-dd hh:mm' : String(c.value ?? '');
        widths[i] = Math.min(Math.max(widths[i], Math.max(...text.split(/\r?\n/).map((s) => s.length)) + 3), 60);
        if (meta) {
          cell.alignment = { horizontal: c.numeric ? numberAlign : textAlign, vertical: 'middle', wrapText: !c.numeric && text.length > 40 };
          cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
          if (rowIndex % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
        }
      });
    });
    const lastData = sheet.rowCount;

    // ---- totals row (SUM formulas) -----------------------------------------------
    if (meta && meta.showTotals !== false && data.length > 0) {
      const totalKeys = keys.map((k, i) => (ADDITIVE_KEYS.has(k) && numericColumn[i] ? i : -1));
      if (totalKeys.some((i) => i >= 0)) {
        const row = sheet.addRow(keys.map(() => null));
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EDF5' } };
          cell.border = { top: { style: 'medium', color: { argb: NAVY } }, bottom: BORDER, left: BORDER, right: BORDER };
        });
        if (totalKeys[0] < 0) {
          row.getCell(1).value = ui.total;
          row.getCell(1).alignment = { horizontal: textAlign };
        }
        totalKeys.forEach((i) => {
          if (i < 0) return;
          const letter = columnLetter(i + 1);
          let sum = 0;
          for (const raw of data) sum += numericValue((raw as Record<string, unknown>)?.[keys[i]]) ?? 0;
          const cell = row.getCell(i + 1);
          cell.value = { formula: `SUM(${letter}${firstData}:${letter}${lastData})`, result: Math.round(sum * 100) / 100 };
          cell.numFmt = MONEY_KEYS.has(keys[i]) ? '#,##0.00' : '#,##0';
          cell.alignment = { horizontal: numberAlign };
        });
      }
    }

    for (let i = 0; i < columnCount; i += 1) sheet.getColumn(i + 1).width = widths[i];

    if (meta && columnCount > 0) {
      if (headerRowNumber > 0) {
        sheet.views = [{ rightToLeft: rtl, showGridLines: false, state: 'frozen', ySplit: headerRowNumber }];
        sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: columnCount } };
      }
      sheet.pageSetup = {
        paperSize: 9,
        orientation: columnCount > 7 ? 'landscape' : 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
        ...(headerRowNumber > 0 ? { printTitlesRow: `${headerRowNumber}:${headerRowNumber}` } : {}),
      };
      sheet.headerFooter = {
        oddFooter: `&C${ui.page} &P ${ui.of} &N`,
      };
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

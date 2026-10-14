/**
 * Unit tests — report rendering (RTL ordering, number formatting, PDF and XLSX layout).
 */
import * as ExcelJS from 'exceljs';
import { visualSegments } from '../src/infrastructure/export/rtl-text';
import { columnTotals, displayText, formatNumber, isNumericColumn } from '../src/infrastructure/export/cell-format';
import { PdfGenerator } from '../src/infrastructure/export/pdf.generator';
import { ExcelGenerator } from '../src/infrastructure/export/excel.generator';
import { ExportMeta, ExportOptions } from '../src/core/entities/export.entity';
import { columnLabel } from '../src/core/constants/export-labels';

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const arMeta: ExportMeta = {
  title: 'تقرير الأصول', organizationName: 'شركة المثال', userName: 'مدير', lang: 'ar', dir: 'rtl',
  orientation: 'auto', generatedAt: '2026-10-14T10:00:00.000Z', summary: 'ملخص تجريبي للتقرير.', signatures: true,
};

function rows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `أصل رقم ${i + 1}`, quantity: 2, purchase_price: 100.5 * (i + 1), status_name: 'نشط', purchase_date: '2024-03-15',
  }));
}

describe('visualSegments (bidi ordering)', () => {
  it('leaves Latin-only text untouched', () => {
    expect(visualSegments('Laptop X1', 'rtl')).toEqual(['Laptop X1']);
    expect(visualSegments('SN-12345', 'rtl')).toEqual(['SN-12345']);
  });

  it('keeps digits as one left-to-right run inside Arabic text', () => {
    expect(visualSegments('غرفة 12 مكتب', 'rtl')).toEqual([' مكتب', '12', 'غرفة ']);
  });

  it('keeps dates and decimal numbers whole', () => {
    expect(visualSegments('مكتب 2026-10-14', 'rtl')).toContain('2026-10-14');
    expect(visualSegments('المبلغ 1,234.50', 'rtl')).toContain('1,234.50');
  });

  it('mirrors brackets that belong to right-to-left runs', () => {
    expect(visualSegments('(مكتب)', 'rtl')).toEqual([')مكتب(']);
  });

  it('orders runs left to right for a left-to-right paragraph', () => {
    expect(visualSegments('abc مكتب', 'ltr')).toEqual(['abc ', 'مكتب']);
  });
});

describe('number formatting', () => {
  it('formats with Latin digits and separators', () => {
    expect(formatNumber(1234567.5)).toBe('1,234,567.50');
    expect(formatNumber(42)).toBe('42');
    expect(displayText('purchase_price', 1200)).toBe('1,200.00');
    expect(displayText('purchase_price', '1200.5')).toBe('1,200.50');
    expect(displayText('barcode', '0012345')).toBe('0012345');
  });

  it('totals only additive columns', () => {
    const data = [{ quantity: 2, purchase_price: '10.5', name: 'a' }, { quantity: 3, purchase_price: 4.5, name: 'b' }];
    expect(columnTotals(['name', 'quantity', 'purchase_price'], data)).toEqual({ quantity: 5, purchase_price: 15 });
    expect(isNumericColumn('quantity', data)).toBe(true);
    expect(isNumericColumn('name', data)).toBe(false);
  });

  it('translates column labels by language', () => {
    expect(columnLabel('status_name', undefined, 'ar')).not.toBe('status_name');
    expect(columnLabel('status_name', 'Custom', 'ar')).toBe('Custom');
  });
});

describe('PdfGenerator — ERP layout', () => {
  const gen = new PdfGenerator();
  const columns = [
    { key: 'name', label: 'اسم الأصل' }, { key: 'quantity', label: 'الكمية' }, { key: 'purchase_price', label: 'سعر الشراء' },
    { key: 'status_name', label: 'الحالة' }, { key: 'purchase_date', label: 'تاريخ الشراء' },
  ];

  it('produces a multi-page A4 portrait RTL report with an embedded Arabic font', async () => {
    const buf = await collect(gen.generate(rows(120), { columns, meta: arMeta } as ExportOptions));
    const text = buf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain('/FontFile2');
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('switches to landscape automatically for wide reports', async () => {
    const wide = Array.from({ length: 9 }, (_, i) => ({ key: `c${i}`, label: `عمود ${i}` }));
    const data = [Object.fromEntries(wide.map((c) => [c.key, 'قيمة']))];
    const buf = await collect(gen.generate(data, { columns: wide, meta: arMeta } as ExportOptions));
    expect(buf.toString('latin1')).toContain('/MediaBox [0 0 841.89 595.28]');
  });

  it('renders an empty report and a draft watermark without failing', async () => {
    const buf = await collect(gen.generate([], { columns, meta: { ...arMeta, draft: true } } as ExportOptions));
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('survives an invalid logo and very long unbroken cells', async () => {
    const data = [{ name: 'X'.repeat(400), quantity: 1, purchase_price: 5, status_name: '', purchase_date: '' }];
    const buf = await collect(gen.generate(data, { columns, meta: { ...arMeta, logo: Buffer.from('not-an-image') } } as ExportOptions));
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('ExcelGenerator — report sheet', () => {
  it('builds a right-to-left sheet with real numbers, dates and a SUM row', async () => {
    const columns = [
      { key: 'name', label: 'الاسم' }, { key: 'quantity', label: 'الكمية' },
      { key: 'purchase_price', label: 'السعر' }, { key: 'purchase_date', label: 'التاريخ' },
    ];
    const data = [
      { name: 'حاسوب', quantity: 2, purchase_price: '1200.50', purchase_date: '2024-03-15' },
      { name: 'طابعة', quantity: 1, purchase_price: 300, purchase_date: '2024-04-01' },
    ];
    const buf = await collect(new ExcelGenerator().generate(data, { columns, meta: arMeta } as ExportOptions));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.views[0].rightToLeft).toBe(true);
    expect(sheet.views[0].state).toBe('frozen');

    let headerRow = 0;
    sheet.eachRow((row, n) => { if (row.getCell(1).value === 'الاسم') headerRow = n; });
    expect(headerRow).toBeGreaterThan(1);
    const first = sheet.getRow(headerRow + 1);
    expect(first.getCell(3).value).toBe(1200.5);
    expect(first.getCell(4).value).toBeInstanceOf(Date);
    const totals = sheet.getRow(headerRow + 3);
    expect(totals.getCell(1).value).toBe('الإجمالي');
    expect(totals.getCell(2).value).toMatchObject({ result: 3 });
    expect(totals.getCell(3).value).toMatchObject({ result: 1500.5 });
  });

  it('keeps a plain table when no meta is given', async () => {
    const buf = await collect(new ExcelGenerator().generate([{ a: 1 }, { a: 2 }]));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets[0].name).toBe('Export');
    expect(workbook.worksheets[0].views[0]?.rightToLeft ?? false).toBe(false);
  });
});

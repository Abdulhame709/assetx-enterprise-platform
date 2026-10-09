import * as ExcelJS from 'exceljs';
import { createHarness, Harness } from './support/db.harness';
import { MasterDataImportService } from '../src/application/master-data-import.service';
import { StatusService } from '../src/application/status.service';
import { StatusRepository } from '../src/infrastructure/repositories/status.repository';

async function workbook(headers: string[], rows: Array<Array<string | number>>): Promise<Buffer> {
  const file = new ExcelJS.Workbook();
  const sheet = file.addWorksheet('بيانات');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await file.xlsx.writeBuffer());
}

describe('Master-data Excel import — integration', () => {
  let h: Harness;
  let importer: MasterDataImportService;

  beforeAll(async () => {
    h = await createHarness();
    const statuses = new StatusService(new StatusRepository(h.db), h.db, h.audit);
    importer = new MasterDataImportService(h.categories, h.locations, statuses, h.employees);
  });

  async function preview(resource: 'categories' | 'locations' | 'statuses' | 'employees', headers: string[], rows: Array<Array<string | number>>) {
    return importer.preview(resource, { originalname: `${resource}.xlsx`, buffer: await workbook(headers, rows) }, h.tenantA);
  }

  async function execute(resource: 'categories' | 'locations' | 'statuses' | 'employees', headers: string[], rows: Array<Array<string | number>>) {
    return importer.importSelected(resource, { originalname: `${resource}.xlsx`, buffer: await workbook(headers, rows) }, h.tenantA);
  }

  it('imports parent-first asset categories after preview and prevents duplicate category names', async () => {
    const rows = [['فئة اختبار رئيسية', ''], ['فئة اختبار فرعية', 'فئة اختبار رئيسية']];
    const inspected = await preview('categories', ['اسم النوع', 'النوع الأب'], rows);
    expect(inspected.valid_rows).toBe(2); expect(inspected.invalid_rows).toBe(0);
    expect((await execute('categories', ['اسم النوع', 'النوع الأب'], rows)).imported).toBe(2);
    expect((await h.categories.list(h.tenantA)).some((item) => item.name === 'فئة اختبار فرعية')).toBe(true);
    const duplicate = await preview('categories', ['اسم النوع'], [['فئة اختبار رئيسية']]);
    expect(duplicate.errors.some((issue) => issue.code === 'IMPORT_DUPLICATE')).toBe(true);
  });

  it('allows the same imported category name under different parents but blocks same-parent duplicates', async () => {
    const rows = [
      ['استيراد أب أول', ''],
      ['استيراد أب ثان', ''],
      ['اسم مشترك مستورد', 'استيراد أب أول'],
      ['اسم مشترك مستورد', 'استيراد أب ثان'],
    ];
    const inspected = await preview('categories', ['اسم النوع', 'النوع الأب'], rows);
    expect(inspected.valid_rows).toBe(4);
    expect(inspected.invalid_rows).toBe(0);
    expect((await execute('categories', ['اسم النوع', 'النوع الأب'], rows)).imported).toBe(4);
    const duplicate = await preview('categories', ['اسم النوع', 'النوع الأب'], [['اسم مشترك مستورد', 'استيراد أب أول']]);
    expect(duplicate.errors.some((issue) => issue.code === 'IMPORT_DUPLICATE')).toBe(true);
  });

  it('imports parent-first locations with localized types and blocks an invalid location type', async () => {
    const rows = [['مبنى اختبار Excel', '', 'مبنى'], ['غرفة اختبار Excel', 'مبنى اختبار Excel', 'غرفة']];
    const inspected = await preview('locations', ['اسم الموقع', 'الموقع الأب', 'نوع الموقع'], rows);
    expect(inspected.valid_rows).toBe(2); expect(inspected.invalid_rows).toBe(0);
    expect((await execute('locations', ['اسم الموقع', 'الموقع الأب', 'نوع الموقع'], rows)).imported).toBe(2);
    const locations = await h.locations.list(h.tenantA);
    expect(locations.find((item) => item.name === 'غرفة اختبار Excel')?.full_path).toContain('مبنى اختبار Excel');
    const invalid = await preview('locations', ['اسم الموقع', 'نوع الموقع'], [['موقع غير صالح', 'مخزن مخصص']]);
    expect(invalid.errors.some((issue) => issue.code === 'IMPORT_LOCATION_TYPE_INVALID')).toBe(true);
  });

  it('imports colored statuses and blocks invalid HEX colors before execution', async () => {
    const inspected = await preview('statuses', ['اسم الحالة', 'اللون'], [['حالة استيراد مؤسسية', '#2563eb']]);
    expect(inspected.valid_rows).toBe(1); expect(inspected.invalid_rows).toBe(0);
    expect((await execute('statuses', ['اسم الحالة', 'اللون'], [['حالة استيراد مؤسسية', '#2563eb']])).imported).toBe(1);
    const invalid = await preview('statuses', ['اسم الحالة', 'اللون'], [['حالة بلون غير صالح', 'blue']]);
    expect(invalid.errors.some((issue) => issue.code === 'IMPORT_COLOR_INVALID')).toBe(true);
  });

  it('imports employees with contact fields and blocks invalid email before execution', async () => {
    const inspected = await preview('employees', ['اسم الموظف', 'القسم', 'الهاتف', 'البريد الإلكتروني'], [['موظف استيراد Excel', 'العمليات', '0500000000', 'excel.employee@example.com']]);
    expect(inspected.valid_rows).toBe(1); expect(inspected.invalid_rows).toBe(0);
    expect((await execute('employees', ['اسم الموظف', 'القسم', 'الهاتف', 'البريد الإلكتروني'], [['موظف استيراد Excel', 'العمليات', '0500000000', 'excel.employee@example.com']])).imported).toBe(1);
    expect((await h.employees.list(h.tenantA)).find((item) => item.name === 'موظف استيراد Excel')?.email).toBe('excel.employee@example.com');
    const invalid = await preview('employees', ['اسم الموظف', 'البريد الإلكتروني'], [['موظف بريد غير صالح', 'not-an-email']]);
    expect(invalid.errors.some((issue) => issue.code === 'IMPORT_EMAIL_INVALID')).toBe(true);
  });
});

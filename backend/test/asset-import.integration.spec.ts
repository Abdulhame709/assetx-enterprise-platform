import * as ExcelJS from 'exceljs';
import { createHarness, Harness } from './support/db.harness';
import { AssetImportService } from '../src/application/asset-import.service';

async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const file = new ExcelJS.Workbook();
  const sheet = file.addWorksheet('بيانات');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await file.xlsx.writeBuffer());
}

describe('Asset Excel import — one name = one base code', () => {
  let h: Harness;
  let importer: AssetImportService;
  let category = ''; let location = ''; let status = '';

  beforeAll(async () => {
    h = await createHarness();
    importer = new AssetImportService(h.db, h.assets);
    await h.db.setTenant(h.tenantA);
    category = (await h.db.query<{ name: string }>('SELECT name FROM asset_categories WHERE id = $1', [h.refA.category])).rows[0].name;
    location = (await h.db.query<{ full_path: string }>('SELECT full_path FROM locations WHERE id = $1', [h.refA.location])).rows[0].full_path;
    status = (await h.db.query<{ name: string }>('SELECT name FROM statuses WHERE id = $1', [h.refA.status])).rows[0].name;
  });

  const headers = ['اسم الأصل', 'نوع الأصل', 'الموقع', 'الحالة', 'الكمية', 'ملاحظات'];
  const file = async (rows: string[][]) => ({ originalname: 'assets.xlsx', buffer: await workbook(headers, rows) });

  it('accepts same-name rows that differ in notes, shares one code, and rejects fully identical rows', async () => {
    const rows = [
      ['كراسي أبو يدين', category, location, status, '5', 'دفعة أولى'],
      ['كراسي ابو  يدين', category, location, status, '2', 'دفعة ثانية'],
      ['كراسي أبو يدين', category, location, status, '1', 'دفعة أولى'],
    ];
    const inspected = await importer.preview(await file(rows), h.tenantA);
    expect(inspected.valid_rows).toBe(2);
    expect(inspected.errors.filter((issue) => issue.code === 'IMPORT_DUPLICATE')).toHaveLength(1);

    const result = await importer.importSelected(await file(rows.slice(0, 2)), h.tenantA);
    expect(result.imported).toBe(2);
    await h.db.setTenant(h.tenantA);
    const saved = await h.db.query<{ base_asset_code: string; full_asset_code: string }>(
      `SELECT base_asset_code, full_asset_code FROM assets WHERE tenant_id = $1 AND name LIKE 'كراسي%'`, [h.tenantA]);
    expect(saved.rows).toHaveLength(2);
    expect(new Set(saved.rows.map((r) => r.base_asset_code)).size).toBe(1);
    expect(new Set(saved.rows.map((r) => r.full_asset_code)).size).toBe(2);
  });
});

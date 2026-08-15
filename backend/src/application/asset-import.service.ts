import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AssetService } from './asset.service';
import { DATABASE_PORT } from '../core/ports/tokens';
import { DatabasePort } from '../core/ports/database.port';

export interface ImportUploadFile { buffer: Buffer; originalname: string; mimetype?: string; }
export interface AssetImportIssue { row: number; code: string; message: string; }
export interface AssetImportPreviewRow { row: number; name: string; category: string; location: string; status: string; quantity: number; purchase_price: number; }
export interface AssetImportPreview { total_rows: number; valid_rows: number; invalid_rows: number; rows: AssetImportPreviewRow[]; errors: AssetImportIssue[]; }
export interface AssetImportResult extends AssetImportPreview { imported: number; skipped: number; }

interface AssetImportInput {
  row: number; name: string; category_id: string; location_id: string; status_id: string;
  employee_id?: string; model_id?: string; quantity: number; purchase_price?: number;
  purchase_date?: string; serial_number?: string; barcode?: string; description?: string; notes?: string;
  category: string; location: string; status: string;
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name', 'asset name': 'name', 'اسم الأصل': 'name', 'اسم الاصل': 'name',
  category: 'category', type: 'category', 'asset type': 'category', 'نوع الأصل': 'category', 'نوع الاصل': 'category', التصنيف: 'category',
  location: 'location', 'asset location': 'location', الموقع: 'location',
  status: 'status', 'asset status': 'status', الحالة: 'status',
  quantity: 'quantity', الكمية: 'quantity',
  purchase_price: 'purchase_price', price: 'purchase_price', 'purchase price': 'purchase_price', 'سعر الشراء': 'purchase_price', السعر: 'purchase_price',
  purchase_date: 'purchase_date', 'purchase date': 'purchase_date', 'تاريخ الشراء': 'purchase_date',
  employee: 'employee', custodian: 'employee', الموظف: 'employee', المستلم: 'employee',
  model: 'model', الموديل: 'model',
  serial_number: 'serial_number', serial: 'serial_number', 'الرقم التسلسلي': 'serial_number',
  barcode: 'barcode', الباركود: 'barcode',
  description: 'description', الوصف: 'description', notes: 'notes', ملاحظات: 'notes',
};

function key(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) return String((value as { text?: unknown }).text ?? '').trim();
  return String(value).trim();
}
function numberValue(value: string, fallback: number): number | null {
  if (!value) return fallback;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function dateValue(value: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

@Injectable()
export class AssetImportService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort, private readonly assets: AssetService) {}

  async createTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AssetX';
    const sheet = workbook.addWorksheet('الأصول', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    sheet.addRow(['اسم الأصل', 'نوع الأصل', 'الموقع', 'الحالة', 'الكمية', 'سعر الشراء', 'تاريخ الشراء', 'الموظف', 'الموديل', 'الرقم التسلسلي', 'الباركود', 'الوصف', 'ملاحظات']);
    sheet.addRow(['مثال: حاسوب محمول', 'اكتب نوعاً موجوداً', 'اكتب موقعاً موجوداً', 'اكتب حالة موجودة', 1, 0, '', '', '', '', '', '', 'احذف هذا الصف قبل الاستيراد']);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C69' } };
    sheet.columns.forEach((column) => { column.width = 20; });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(file: ImportUploadFile, tenantId: string): Promise<AssetImportPreview> {
    const parsed = await this.parse(file, tenantId);
    return this.toPreview(parsed.rows, parsed.errors, parsed.totalRows);
  }

  async importSelected(file: ImportUploadFile, tenantId: string): Promise<AssetImportResult> {
    const parsed = await this.parse(file, tenantId);
    const errors = [...parsed.errors];
    let imported = 0;
    for (const row of parsed.rows) {
      try {
        await this.assets.create({
          tenant_id: tenantId, name: row.name, category_id: row.category_id, location_id: row.location_id, status_id: row.status_id,
          employee_id: row.employee_id, model_id: row.model_id, quantity: row.quantity, purchase_price: row.purchase_price,
          purchase_date: row.purchase_date, serial_number: row.serial_number, barcode: row.barcode, description: row.description, notes: row.notes,
        });
        imported += 1;
      } catch {
        errors.push({ row: row.row, code: 'IMPORT_CREATE_FAILED', message: 'تعذر إنشاء الأصل؛ راجع البيانات والمراجع ثم أعد المحاولة.' });
      }
    }
    const preview = this.toPreview(parsed.rows, errors, parsed.totalRows);
    return { ...preview, imported, skipped: errors.length };
  }

  private async parse(file: ImportUploadFile, tenantId: string): Promise<{ rows: AssetImportInput[]; errors: AssetImportIssue[]; totalRows: number }> {
    if (!file?.buffer?.length) throw new BadRequestException('IMPORT_FILE_REQUIRED');
    if (file.buffer.length > 2 * 1024 * 1024 || !/\.xlsx$/i.test(file.originalname ?? '')) throw new BadRequestException('IMPORT_FILE_INVALID');
    const workbook = new ExcelJS.Workbook();
    // exceljs ships a Node Buffer declaration that conflicts structurally with Node 22's generic Buffer type.
    // The runtime object remains the original multer Buffer; `never` only bridges the duplicate declarations.
    try { await workbook.xlsx.load(file.buffer as never); } catch { throw new BadRequestException('IMPORT_FILE_INVALID'); }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('IMPORT_SHEET_REQUIRED');

    const headerRow = sheet.getRow(1);
    const headers = new Map<string, number>();
    headerRow.eachCell((cell, column) => { const canonical = HEADER_ALIASES[key(text(cell.value))]; if (canonical) headers.set(canonical, column); });
    const errors: AssetImportIssue[] = [];
    for (const required of ['name', 'category', 'location', 'status']) {
      if (!headers.has(required)) errors.push({ row: 1, code: 'IMPORT_HEADER_REQUIRED', message: `العمود المطلوب غير موجود: ${required}.` });
    }
    if (errors.length) return { rows: [], errors, totalRows: Math.max(0, sheet.rowCount - 1) };

    await this.db.setTenant(tenantId);
    const [categories, locations, statuses, employees, models, existing] = await Promise.all([
      this.db.query<{ id: string; name: string }>('SELECT id, name FROM asset_categories WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      this.db.query<{ id: string; name: string; full_path: string }>('SELECT id, name, full_path FROM locations WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      this.db.query<{ id: string; name: string }>('SELECT id, name FROM statuses WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      this.db.query<{ id: string; name: string }>('SELECT id, name FROM employees WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      this.db.query<{ id: string; name: string }>('SELECT id, name FROM asset_models WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      this.db.query<{ name: string; location_id: string }>('SELECT name, location_id FROM assets WHERE tenant_id = $1 AND is_active = true', [tenantId]),
    ]);
    const lookup = (items: Array<{ id: string; name: string }>, includePath = false) => {
      const map = new Map<string, string[]>();
      for (const item of items) {
        const keys = [item.name, ...(includePath && 'full_path' in item ? [String((item as { full_path: string }).full_path)] : [])];
        for (const candidate of keys) {
          const existingIds = map.get(key(candidate)) ?? [];
          if (!existingIds.includes(item.id)) map.set(key(candidate), [...existingIds, item.id]);
        }
      }
      return map;
    };
    const categoryMap = lookup(categories.rows); const locationMap = lookup(locations.rows, true); const statusMap = lookup(statuses.rows); const employeeMap = lookup(employees.rows); const modelMap = lookup(models.rows);
    const duplicateKeys = new Set(existing.rows.map((asset) => `${key(asset.name)}|${asset.location_id}`));
    const fileKeys = new Set<string>();
    const resolve = (map: Map<string, string[]>, value: string, label: string, row: number, required: boolean): string | undefined => {
      if (!value && !required) return undefined;
      const matches = map.get(key(value)) ?? [];
      if (matches.length === 1) return matches[0];
      errors.push({ row, code: matches.length > 1 ? 'IMPORT_REFERENCE_AMBIGUOUS' : 'IMPORT_REFERENCE_NOT_FOUND', message: matches.length > 1 ? `مرجع ${label} غير محدد بشكل فريد: ${value}.` : `لم يتم العثور على ${label}: ${value}.` });
      return undefined;
    };

    const rows: AssetImportInput[] = [];
    let totalRows = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const value = (header: string) => {
        const column = headers.get(header);
        return column ? text(row.getCell(column).value) : '';
      };
      if (![...headers.values()].some((column) => text(row.getCell(column).value))) continue;
      totalRows += 1;
      const name = value('name'); const category = value('category'); const location = value('location'); const status = value('status');
      const before = errors.length;
      if (name.length < 2) errors.push({ row: rowNumber, code: 'IMPORT_NAME_INVALID', message: 'اسم الأصل يجب أن يتكون من حرفين على الأقل.' });
      const categoryId = resolve(categoryMap, category, 'نوع الأصل', rowNumber, true);
      const locationId = resolve(locationMap, location, 'الموقع', rowNumber, true);
      const statusId = resolve(statusMap, status, 'الحالة', rowNumber, true);
      const quantity = numberValue(value('quantity'), 1);
      const purchasePrice = numberValue(value('purchase_price'), 0);
      if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) errors.push({ row: rowNumber, code: 'IMPORT_QUANTITY_INVALID', message: 'الكمية يجب أن تكون عدداً صحيحاً أكبر من صفر.' });
      if (purchasePrice === null || purchasePrice < 0) errors.push({ row: rowNumber, code: 'IMPORT_PRICE_INVALID', message: 'سعر الشراء يجب أن يكون صفراً أو رقماً موجباً.' });
      const purchaseDate = dateValue(value('purchase_date'));
      if (value('purchase_date') && !purchaseDate) errors.push({ row: rowNumber, code: 'IMPORT_DATE_INVALID', message: 'تاريخ الشراء غير صالح.' });
      const employeeId = resolve(employeeMap, value('employee'), 'الموظف', rowNumber, false);
      const modelId = resolve(modelMap, value('model'), 'الموديل', rowNumber, false);
      const duplicateKey = locationId ? `${key(name)}|${locationId}` : '';
      if (duplicateKey && (duplicateKeys.has(duplicateKey) || fileKeys.has(duplicateKey))) errors.push({ row: rowNumber, code: 'IMPORT_DUPLICATE', message: 'يوجد أصل نشط بالاسم والموقع نفسيهما.' });
      if (errors.length > before || !categoryId || !locationId || !statusId || quantity === null || purchasePrice === null || !purchaseDate && value('purchase_date')) continue;
      fileKeys.add(duplicateKey);
      rows.push({ row: rowNumber, name, category_id: categoryId, location_id: locationId, status_id: statusId, employee_id: employeeId, model_id: modelId, quantity, purchase_price: purchasePrice || undefined, purchase_date: purchaseDate, serial_number: value('serial_number') || undefined, barcode: value('barcode') || undefined, description: value('description') || undefined, notes: value('notes') || undefined, category, location, status });
    }
    return { rows, errors, totalRows };
  }

  private toPreview(rows: AssetImportInput[], errors: AssetImportIssue[], totalRows: number): AssetImportPreview {
    return { total_rows: totalRows, valid_rows: rows.length, invalid_rows: errors.length, rows: rows.slice(0, 20).map((row) => ({ row: row.row, name: row.name, category: row.category, location: row.location, status: row.status, quantity: row.quantity, purchase_price: row.purchase_price ?? 0 })), errors: errors.slice(0, 50) };
  }
}

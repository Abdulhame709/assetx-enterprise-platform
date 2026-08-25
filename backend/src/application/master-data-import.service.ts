import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CategoryService } from './category.service';
import { EmployeeService } from './employee.service';
import { LocationService } from './location.service';
import { StatusService } from './status.service';
import { ImportUploadFile } from './asset-import.service';

export const MASTER_DATA_IMPORT_RESOURCES = ['categories', 'locations', 'statuses', 'employees'] as const;
export type MasterDataImportResource = typeof MASTER_DATA_IMPORT_RESOURCES[number];

export interface MasterDataImportIssue { row: number; code: string; message: string; }
export interface MasterDataImportPreviewRow { row: number; values: Record<string, string | number>; }
export interface MasterDataImportPreview {
  resource: MasterDataImportResource;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: MasterDataImportPreviewRow[];
  errors: MasterDataImportIssue[];
}
export interface MasterDataImportResult extends MasterDataImportPreview { imported: number; skipped: number; }

type ParsedRow = { row: number; name: string; parent?: string; location_type?: LocationType; color?: string; department?: string; phone?: string; email?: string; };
type LocationType = 'building' | 'room' | 'warehouse' | 'workshop' | 'outdoor';

const RESOURCE_CONFIG: Record<MasterDataImportResource, { sheet: string; headers: string[]; sample: Array<string | number> }> = {
  categories: { sheet: 'أنواع الأصول', headers: ['اسم النوع', 'النوع الأب'], sample: ['مثال: أجهزة تقنية', ''] },
  locations: { sheet: 'المواقع', headers: ['اسم الموقع', 'الموقع الأب', 'نوع الموقع'], sample: ['مثال: المقر الرئيسي', '', 'building'] },
  statuses: { sheet: 'حالات الأصول', headers: ['اسم الحالة', 'اللون'], sample: ['مثال: متاح', '#16a34a'] },
  employees: { sheet: 'الموظفون', headers: ['اسم الموظف', 'القسم', 'الهاتف', 'البريد الإلكتروني'], sample: ['مثال: أحمد محمد', 'تقنية المعلومات', '0500000000', 'ahmad@example.com'] },
};

const HEADER_ALIASES: Record<MasterDataImportResource, Record<string, string>> = {
  categories: { name: 'name', 'category name': 'name', 'asset type': 'name', 'اسم النوع': 'name', 'اسم التصنيف': 'name', 'نوع الأصل': 'name', 'النوع الأب': 'parent', 'التصنيف الأب': 'parent', 'الفئة الأب': 'parent', parent: 'parent', 'parent category': 'parent' },
  locations: { name: 'name', location: 'name', 'location name': 'name', 'اسم الموقع': 'name', 'الموقع الأب': 'parent', 'الموقع الرئيسي': 'parent', parent: 'parent', 'parent location': 'parent', location_type: 'location_type', 'location type': 'location_type', 'نوع الموقع': 'location_type' },
  statuses: { name: 'name', status: 'name', 'status name': 'name', 'اسم الحالة': 'name', color: 'color', colour: 'color', اللون: 'color' },
  employees: { name: 'name', employee: 'name', 'employee name': 'name', 'اسم الموظف': 'name', department: 'department', القسم: 'department', phone: 'phone', mobile: 'phone', الهاتف: 'phone', الجوال: 'phone', email: 'email', 'e-mail': 'email', 'البريد الإلكتروني': 'email', 'البريد الالكتروني': 'email' },
};

const LOCATION_TYPES: Record<string, LocationType> = { building: 'building', 'مبنى': 'building', room: 'room', 'غرفة': 'room', warehouse: 'warehouse', 'مستودع': 'warehouse', workshop: 'workshop', 'ورشة': 'workshop', outdoor: 'outdoor', 'خارجي': 'outdoor' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function key(value: string): string { return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) return String((value as { text?: unknown }).text ?? '').trim();
  return String(value).trim();
}
function isResource(value: string): value is MasterDataImportResource { return (MASTER_DATA_IMPORT_RESOURCES as readonly string[]).includes(value); }

@Injectable()
export class MasterDataImportService {
  constructor(
    private readonly categories: CategoryService,
    private readonly locations: LocationService,
    private readonly statuses: StatusService,
    private readonly employees: EmployeeService,
  ) {}

  async createTemplate(resource: MasterDataImportResource): Promise<Buffer> {
    const config = RESOURCE_CONFIG[resource];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AssetX';
    const sheet = workbook.addWorksheet(config.sheet, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    sheet.addRow(config.headers);
    sheet.addRow(config.sample);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C69' } };
    sheet.columns.forEach((column) => { column.width = 23; });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(resource: string, file: ImportUploadFile, tenantId: string): Promise<MasterDataImportPreview> {
    const safeResource = this.resource(resource);
    const parsed = await this.parse(safeResource, file, tenantId);
    return this.toPreview(safeResource, parsed.rows, parsed.errors, parsed.totalRows);
  }

  async importSelected(resource: string, file: ImportUploadFile, tenantId: string): Promise<MasterDataImportResult> {
    const safeResource = this.resource(resource);
    const parsed = await this.parse(safeResource, file, tenantId);
    const errors = [...parsed.errors];
    let imported = 0;
    const categoryMap = new Map((await this.categories.list(tenantId)).map((item) => [key(item.name), item.id]));
    const locationMap = new Map((await this.locations.list(tenantId)).flatMap((item) => [[key(item.name), item.id], [key(item.full_path), item.id]]));
    for (const row of parsed.rows) {
      try {
        if (safeResource === 'categories') {
          const parentId = row.parent ? categoryMap.get(key(row.parent)) : undefined;
          const created = await this.categories.create({ tenant_id: tenantId, name: row.name, parent_id: parentId ?? null });
          categoryMap.set(key(created.name), created.id);
        } else if (safeResource === 'locations') {
          const parentId = row.parent ? locationMap.get(key(row.parent)) : undefined;
          const created = await this.locations.create({ tenant_id: tenantId, name: row.name, parent_id: parentId ?? null, location_type: row.location_type });
          locationMap.set(key(created.name), created.id);
          locationMap.set(key(created.full_path), created.id);
        } else if (safeResource === 'statuses') {
          await this.statuses.create({ tenant_id: tenantId, name: row.name, color: row.color ?? null });
        } else {
          await this.employees.create({ tenant_id: tenantId, name: row.name, department: row.department ?? null, phone: row.phone ?? null, email: row.email ?? null });
        }
        imported += 1;
      } catch {
        errors.push({ row: row.row, code: 'IMPORT_CREATE_FAILED', message: 'تعذر إنشاء السجل؛ راجع البيانات والمراجع ثم أعد المحاولة.' });
      }
    }
    return { ...this.toPreview(safeResource, parsed.rows, errors, parsed.totalRows), imported, skipped: errors.length };
  }

  private resource(value: string): MasterDataImportResource {
    if (!isResource(value)) throw new BadRequestException('IMPORT_RESOURCE_INVALID');
    return value;
  }

  private async parse(resource: MasterDataImportResource, file: ImportUploadFile, tenantId: string): Promise<{ rows: ParsedRow[]; errors: MasterDataImportIssue[]; totalRows: number }> {
    if (!file?.buffer?.length) throw new BadRequestException('IMPORT_FILE_REQUIRED');
    if (file.buffer.length > 2 * 1024 * 1024 || !/\.xlsx$/i.test(file.originalname ?? '')) throw new BadRequestException('IMPORT_FILE_INVALID');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(file.buffer as never); } catch { throw new BadRequestException('IMPORT_FILE_INVALID'); }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('IMPORT_SHEET_REQUIRED');
    const aliases = HEADER_ALIASES[resource];
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => { const canonical = aliases[key(text(cell.value))]; if (canonical) headers.set(canonical, column); });
    const errors: MasterDataImportIssue[] = [];
    if (!headers.has('name')) errors.push({ row: 1, code: 'IMPORT_HEADER_REQUIRED', message: 'العمود المطلوب غير موجود: الاسم.' });
    if (errors.length) return { rows: [], errors, totalRows: Math.max(0, sheet.rowCount - 1) };

    const existing = await this.loadExisting(resource, tenantId);
    const fileNames = new Set<string>();
    const categoryKeys = new Set<string>(existing.categoryKeys);
    const parentNames = new Set<string>(existing.parentNames);
    const locationKeys = new Set<string>(existing.locationKeys);
    const rows: ParsedRow[] = [];
    let totalRows = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const excelRow = sheet.getRow(rowNumber);
      const value = (header: string) => { const column = headers.get(header); return column ? text(excelRow.getCell(column).value) : ''; };
      if (![...headers.values()].some((column) => text(excelRow.getCell(column).value))) continue;
      totalRows += 1;
      const name = value('name'); const parent = value('parent'); const before = errors.length;
      if (name.length < 2) errors.push({ row: rowNumber, code: 'IMPORT_NAME_INVALID', message: 'الاسم يجب أن يتكون من حرفين على الأقل.' });
      const normalizedName = key(name);
      if (resource === 'locations') {
        const parentKey = key(parent);
        if (parent && !parentNames.has(parentKey)) errors.push({ row: rowNumber, code: 'IMPORT_PARENT_NOT_FOUND', message: `لم يتم العثور على الموقع الأب: ${parent}. ضع صف الموقع الأب قبل هذا الصف أو استخدم مساره الكامل.` });
        const uniqueKey = `${normalizedName}|${parentKey}`;
        if (locationKeys.has(uniqueKey)) errors.push({ row: rowNumber, code: 'IMPORT_DUPLICATE', message: 'يوجد موقع نشط بالاسم والموقع الأب نفسيهما.' });
        const typeText = value('location_type'); const locationType = typeText ? LOCATION_TYPES[key(typeText)] : undefined;
        if (typeText && !locationType) errors.push({ row: rowNumber, code: 'IMPORT_LOCATION_TYPE_INVALID', message: 'نوع الموقع غير صالح. استخدم building أو room أو warehouse أو workshop أو outdoor.' });
        if (errors.length === before) { locationKeys.add(uniqueKey); parentNames.add(normalizedName); rows.push({ row: rowNumber, name, parent: parent || undefined, location_type: locationType }); }
      } else if (resource === 'categories') {
        const parentKey = key(parent);
        if (parent && !parentNames.has(parentKey)) errors.push({ row: rowNumber, code: 'IMPORT_PARENT_NOT_FOUND', message: `لم يتم العثور على النوع الأب: ${parent}. ضع صف النوع الأب قبل هذا الصف.` });
        const uniqueKey = `${normalizedName}|${parentKey}`;
        if (categoryKeys.has(uniqueKey)) errors.push({ row: rowNumber, code: 'IMPORT_DUPLICATE', message: 'يوجد نوع أصل نشط بالاسم نفسه تحت النوع الأب نفسه.' });
        if (errors.length === before) { categoryKeys.add(uniqueKey); parentNames.add(normalizedName); rows.push({ row: rowNumber, name, parent: parent || undefined }); }
      } else if (resource === 'statuses') {
        const color = value('color');
        if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) errors.push({ row: rowNumber, code: 'IMPORT_COLOR_INVALID', message: 'لون الحالة يجب أن يكون بصيغة HEX مثل #2563eb.' });
        if (existing.names.has(normalizedName) || fileNames.has(normalizedName)) errors.push({ row: rowNumber, code: 'IMPORT_DUPLICATE', message: 'توجد حالة أصل نشطة بالاسم نفسه.' });
        if (errors.length === before) { fileNames.add(normalizedName); rows.push({ row: rowNumber, name, color: color || undefined }); }
      } else {
        const email = value('email');
        if (email && !EMAIL_PATTERN.test(email)) errors.push({ row: rowNumber, code: 'IMPORT_EMAIL_INVALID', message: 'البريد الإلكتروني غير صالح.' });
        if (existing.names.has(normalizedName) || fileNames.has(normalizedName)) errors.push({ row: rowNumber, code: 'IMPORT_DUPLICATE', message: 'يوجد موظف نشط بالاسم نفسه.' });
        if (errors.length === before) { fileNames.add(normalizedName); rows.push({ row: rowNumber, name, department: value('department') || undefined, phone: value('phone') || undefined, email: email || undefined }); }
      }
    }
    return { rows, errors, totalRows };
  }

  private async loadExisting(resource: MasterDataImportResource, tenantId: string): Promise<{ names: Set<string>; parentNames: Set<string>; locationKeys: Set<string>; categoryKeys: Set<string> }> {
    if (resource === 'categories') {
      const values = await this.categories.list(tenantId);
      const names = new Set(values.map((item) => key(item.name)));
      const byId = new Map(values.map((item) => [item.id, item]));
      const categoryKeys = new Set(values.map((item) => `${key(item.name)}|${key(byId.get(item.parent_id ?? '')?.name ?? '')}`));
      return { names, parentNames: names, locationKeys: new Set(), categoryKeys };
    }
    if (resource === 'locations') {
      const values = await this.locations.list(tenantId);
      const parentNames = new Set(values.flatMap((item) => [key(item.name), key(item.full_path)]));
      const locationKeys = new Set(values.map((item) => `${key(item.name)}|${key(values.find((candidate) => candidate.id === item.parent_id)?.full_path ?? '')}`));
      return { names: new Set(values.map((item) => key(item.name))), parentNames, locationKeys, categoryKeys: new Set() };
    }
    if (resource === 'statuses') {
      const values = await this.statuses.list(tenantId); return { names: new Set(values.map((item) => key(item.name))), parentNames: new Set(), locationKeys: new Set(), categoryKeys: new Set() };
    }
    const values = await this.employees.list(tenantId); return { names: new Set(values.map((item) => key(item.name))), parentNames: new Set(), locationKeys: new Set(), categoryKeys: new Set() };
  }

  private toPreview(resource: MasterDataImportResource, rows: ParsedRow[], errors: MasterDataImportIssue[], totalRows: number): MasterDataImportPreview {
    return {
      resource, total_rows: totalRows, valid_rows: rows.length, invalid_rows: errors.length,
      rows: rows.slice(0, 20).map((row) => {
        const values: Record<string, string | number> = { name: row.name };
        if (row.parent !== undefined) values.parent = row.parent;
        if (row.location_type !== undefined) values.location_type = row.location_type;
        if (row.color !== undefined) values.color = row.color;
        if (row.department !== undefined) values.department = row.department;
        if (row.phone !== undefined) values.phone = row.phone;
        if (row.email !== undefined) values.email = row.email;
        return { row: row.row, values };
      }),
      errors: errors.slice(0, 50),
    };
  }
}

/**
 * Export labels — Arabic/English display text for report titles and column
 * headers. Presentation only: used by the report generators and the report
 * meta service so an Arabic report never prints raw field names.
 */
import { ExportResource } from '../entities/export.entity';

export type ReportLang = 'ar' | 'en';

export const RESOURCE_TITLES: Record<ExportResource, Record<ReportLang, string>> = {
  assets: { ar: 'تقرير الأصول', en: 'Assets Report' },
  movements: { ar: 'تقرير حركات الأصول', en: 'Asset Movements Report' },
  inventory: { ar: 'تقرير الجرد', en: 'Inventory Report' },
  audit: { ar: 'سجل التدقيق', en: 'Audit Log' },
  dashboard: { ar: 'ملخص مؤشرات الأصول', en: 'Assets Dashboard Summary' },
};

export const PROFILE_NAMES: Record<string, Record<ReportLang, string>> = {
  executive: { ar: 'تنفيذي', en: 'Executive' },
  finance: { ar: 'مالي', en: 'Finance' },
  auditor: { ar: 'مدقق', en: 'Auditor' },
  inventory: { ar: 'جرد', en: 'Inventory' },
  compliance: { ar: 'امتثال', en: 'Compliance' },
};

export const AGGREGATE_NAMES: Record<string, Record<ReportLang, string>> = {
  count: { ar: 'العدد', en: 'Count' },
  sum: { ar: 'المجموع', en: 'Sum' },
  avg: { ar: 'المتوسط', en: 'Average' },
  min: { ar: 'الأدنى', en: 'Minimum' },
  max: { ar: 'الأعلى', en: 'Maximum' },
};

/** Column header per field key. English values match the profile defaults. */
export const COLUMN_LABELS: Record<string, Record<ReportLang, string>> = {
  // assets
  name: { ar: 'اسم الأصل', en: 'Asset' },
  full_asset_code: { ar: 'رمز الأصل', en: 'Asset Code' },
  base_asset_code: { ar: 'الرمز الأساسي', en: 'Base Code' },
  category_name: { ar: 'الفئة', en: 'Category' },
  status_name: { ar: 'الحالة', en: 'Status' },
  location_name: { ar: 'الموقع', en: 'Location' },
  employee_name: { ar: 'المستلم', en: 'Custodian' },
  quantity: { ar: 'الكمية', en: 'Qty' },
  purchase_price: { ar: 'سعر الشراء', en: 'Purchase Price' },
  purchase_date: { ar: 'تاريخ الشراء', en: 'Purchase Date' },
  depreciation_rate: { ar: 'نسبة الإهلاك', en: 'Depreciation Rate' },
  useful_life: { ar: 'العمر الإنتاجي (سنة)', en: 'Useful Life' },
  serial_number: { ar: 'الرقم التسلسلي', en: 'Serial No' },
  barcode: { ar: 'الباركود', en: 'Barcode' },
  reference_number: { ar: 'الرقم المرجعي', en: 'Reference number' },
  is_active: { ar: 'نشط', en: 'Active' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  // movements
  asset_name: { ar: 'الأصل', en: 'Asset' },
  asset_code: { ar: 'رمز الأصل', en: 'Asset Code' },
  movement_type: { ar: 'نوع الحركة', en: 'Movement type' },
  status: { ar: 'الحالة', en: 'Status' },
  from_location_name: { ar: 'من موقع', en: 'From location' },
  to_location_name: { ar: 'إلى موقع', en: 'To location' },
  from_employee_name: { ar: 'من المستلم', en: 'From custodian' },
  to_employee_name: { ar: 'إلى المستلم', en: 'To custodian' },
  from_status_name: { ar: 'من حالة', en: 'From status' },
  to_status_name: { ar: 'إلى حالة', en: 'To status' },
  performed_by_name: { ar: 'نفّذها', en: 'Performed by' },
  created_at: { ar: 'تاريخ الإنشاء', en: 'Created at' },
  approved_at: { ar: 'تاريخ الاعتماد', en: 'Approved at' },
  reason: { ar: 'السبب', en: 'Reason' },
  // inventory
  expected_quantity: { ar: 'الكمية المتوقعة', en: 'Expected Qty' },
  actual_quantity: { ar: 'الكمية الفعلية', en: 'Actual Qty' },
  expected_location_path: { ar: 'الموقع المتوقع', en: 'Expected Location' },
  actual_location_path: { ar: 'الموقع الفعلي', en: 'Actual Location' },
  expected_employee_name: { ar: 'المستلم المتوقع', en: 'Expected Custodian' },
  actual_employee_name: { ar: 'المستلم الفعلي', en: 'Actual Custodian' },
  expected_status_name: { ar: 'الحالة المتوقعة', en: 'Expected Status' },
  actual_status_name: { ar: 'الحالة الفعلية', en: 'Actual Status' },
  result: { ar: 'النتيجة', en: 'Result' },
  // audit
  action_type: { ar: 'الإجراء', en: 'Action' },
  entity: { ar: 'الكيان', en: 'Entity' },
  entity_id: { ar: 'معرّف الكيان', en: 'Entity ID' },
  user_name: { ar: 'المستخدم', en: 'User' },
  ip_address: { ar: 'عنوان IP', en: 'IP address' },
  metadata: { ar: 'التفاصيل', en: 'Details' },
  // dashboard + grouped output
  section: { ar: 'القسم', en: 'Section' },
  metric: { ar: 'المؤشر', en: 'Metric' },
  value: { ar: 'القيمة', en: 'Value' },
  count: { ar: 'العدد', en: 'Count' },
  sum: { ar: 'المجموع', en: 'Sum' },
  avg: { ar: 'المتوسط', en: 'Average' },
  min: { ar: 'الأدنى', en: 'Minimum' },
  max: { ar: 'الأعلى', en: 'Maximum' },
};

/**
 * Header text for a column. A caller-supplied label always wins unless it is
 * just the raw key or the profile's English default and the report is Arabic.
 */
export function columnLabel(key: string, label: string | undefined, lang: ReportLang): string {
  const known = COLUMN_LABELS[key];
  if (!known) return label ?? key;
  if (!label || label === key) return known[lang];
  if (lang === 'ar' && label === known.en) return known.ar;
  return label;
}

/** Fields that can be added up in a totals row (money and quantities only). */
export const ADDITIVE_KEYS = new Set([
  'purchase_price', 'quantity', 'expected_quantity', 'actual_quantity', 'count', 'sum',
]);

/** Fields printed with thousands separators and (for money) two decimals. */
export const MONEY_KEYS = new Set(['purchase_price', 'sum', 'avg', 'min', 'max']);
export const NUMERIC_KEYS = new Set([
  ...MONEY_KEYS, 'quantity', 'expected_quantity', 'actual_quantity', 'count', 'depreciation_rate', 'useful_life',
]);

/** Fixed texts printed by the report generators (PDF / Excel). */
export const REPORT_TEXT: Record<ReportLang, {
  generatedAt: string; generatedBy: string; total: string; page: string; of: string; draft: string;
  noData: string; summary: string; preparedBy: string; reviewedBy: string; approvedBy: string; signature: string;
  date: string; rowsCount: string; sheet: string;
}> = {
  ar: {
    generatedAt: 'تاريخ الإصدار', generatedBy: 'أصدره', total: 'الإجمالي', page: 'صفحة', of: 'من', draft: 'مسودة',
    noData: 'لا توجد بيانات للعرض', summary: 'الملخص', preparedBy: 'أعدّه', reviewedBy: 'راجعه', approvedBy: 'اعتمده',
    signature: 'التوقيع', date: 'التاريخ', rowsCount: 'عدد السجلات', sheet: 'التقرير',
  },
  en: {
    generatedAt: 'Generated', generatedBy: 'Generated by', total: 'Total', page: 'Page', of: 'of', draft: 'DRAFT',
    noData: 'No data to display', summary: 'Summary', preparedBy: 'Prepared by', reviewedBy: 'Reviewed by', approvedBy: 'Approved by',
    signature: 'Signature', date: 'Date', rowsCount: 'Records', sheet: 'Report',
  },
};

/** AssetX — إصلاح نتيجة الجرد الفعلية (field-sync) + عمود الحالة الفعلية في تقرير الجرد.
 *
 *  يعدّل 6 ملفات في المشروع الحالي:
 *  1) الهاتف (Mobile): إرسال actual_location_id = الموقع المتوقع عند العدّ → النتيجة «مطابق».
 *  2) Backend: نتيجة الجرد مع اسم الحالة المتوقعة/الفعلية (المتاحة للتقرير والتصدير).
 *  3) Web: عمودا «الحالة المتوقعة/الحالة الفعلية» في تقرير الجرد (EN + AR).
 *
 *  يعمل من جذر المشروع:  node patch-mobile-result-fix.js
 *  - ينشئ نسخة احتياطية .bak-syncfix لكل ملف قبل التعديل (آمن).
 *  - قابل للتكرار: إذا كان الإصلاح مطبقاً يطبع ALREADY دون تغيير.
 */
const fs = require('fs');
const path = require('path');

function findRoot() {
  for (const cand of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(cand, 'web', 'package.json')) && fs.existsSync(path.join(cand, 'backend', 'package.json'))) {
      return cand;
    }
  }
  return null;
}

function readText(p) {
  return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function patchFile(root, rel, oldStr, newStr, label) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { console.log('MISS  ' + label + ' — الملف غير موجود: ' + rel); return false; }
  let t = readText(p);
  if (t.includes(newStr)) { console.log('ALREADY ' + label); return true; }
  if (!t.includes(oldStr)) { console.log('MISS  ' + label + ' — لم يتم العثور على موضع التعديل (مزيد من التطوير)' + rel); return false; }
  const bak = p + '.bak-syncfix';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, t, 'utf8');
  t = t.split(oldStr).join(newStr);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK    ' + label + ' (' + t.split('\n').length + ' سطراً)');
  return true;
}

function main() {
  const root = findRoot();
  if (!root) { console.log('MISS: لم يتم العثور على جذر المشروع (بجوار web/ و backend/)'); process.exit(2); }
  console.log('الجذر: ' + root);
  let ok = 0;

  // 1) Mobile — count screen sends the expected location
  if (patchFile(root,
    'Mobile/AssetXMobile/app/inventory/[cycleId]/record/[recordId].tsx',
    'actual_quantity: actualQuantity, actual_status_id: actualStatusId, notes: combinedNotes',
    'actual_quantity: actualQuantity, actual_location_id: record.actual_location_id ?? record.expected_location_id, actual_status_id: actualStatusId, notes: combinedNotes',
    '1/6 Mobile: إرسال الموقع الفعلي عند العدّ')) ok++;

  // 2) Backend — result repository joins status names
  const oldSql = `    const { rows } = await this.db.query<InventoryRecordResult>(
      \`SELECT * FROM v_inventory_result WHERE cycle_id = $1 ORDER BY id\`,
      [cycleId],
    );`;
  const newSql = `    // The v_inventory_result view exposes the computed result but only a subset
    // of columns, so status ids are read from inventory_records directly and the
    // human-readable status names are joined for reports/exports.
    const { rows } = await this.db.query<InventoryRecordResult>(
      \`SELECT
         ir.id, ir.tenant_id, ir.cycle_id, ir.asset_id,
         ir.expected_location_id, ir.expected_quantity, ir.expected_status_id,
         ir.expected_employee_id, ir.actual_location_id, ir.actual_quantity,
         ir.actual_status_id, ir.actual_employee_id,
         ir.inventory_date, ir.inventory_by, ir.is_verified, ir.verified_by,
         ir.verified_date, ir.notes, ir.created_at, ir.updated_at,
         vw.result,
         es.name AS expected_status_name,
         ast.name AS actual_status_name
       FROM inventory_records ir
       JOIN v_inventory_result vw ON vw.id = ir.id
       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id
       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id
       WHERE ir.cycle_id = $1
       ORDER BY ir.id\`,
      [cycleId],
    );`;
  if (patchFile(root, 'backend/src/infrastructure/repositories/result.repository.ts', oldSql, newSql,
    '2/6 Backend: نتيجة الجرد مع أسماء الحالات')) ok++;

  // 3) Backend — entity exposes status names on the result row
  if (patchFile(root,
    'backend/src/core/entities/inventory.entity.ts',
    'export interface InventoryRecordResult extends InventoryRecord {\n  result: InventoryResult;\n}',
    'export interface InventoryRecordResult extends InventoryRecord {\n  result: InventoryResult;\n  expected_status_name?: string | null;\n  actual_status_name?: string | null;\n}',
    '3/6 Backend: النوع InventoryRecordResult')) ok++;

  // 4) Backend — inventory profile column
  if (patchFile(root,
    'backend/src/application/export/export-profile.registry.ts',
    "          { key: 'barcode', label: 'Barcode', order: 6 },\n        ],\n      },\n      compliance: {",
    "          { key: 'barcode', label: 'Barcode', order: 6 },\n          { key: 'actual_status_name', label: 'Actual Status', order: 7 },\n        ],\n      },\n      compliance: {",
    '4/6 Backend: عمود الحالة الفعلية في قالب الجرد')) ok++;

  // 5) Web — reports columns (status pair + renumber)
  const web1 = patchFile(root,
    'web/src/app/(dashboard)/reports/page.tsx',
    `    { key: 'actual_quantity', label: '', labelKey: 'module.reportsColumnActualQuantity', order: 5 },
    { key: 'result', label: '', labelKey: 'module.reportsColumnInventoryResult', order: 6 },
    { key: 'inventory_date', label: '', labelKey: 'module.reportsColumnInventoryDate', order: 7 },
    { key: 'notes', label: '', labelKey: 'module.reportsColumnNotes', order: 8 },
  ],`,
    `    { key: 'actual_quantity', label: '', labelKey: 'module.reportsColumnActualQuantity', order: 5 },
    { key: 'expected_status_name', label: '', labelKey: 'module.reportsColumnExpectedStatus', order: 6 },
    { key: 'actual_status_name', label: '', labelKey: 'module.reportsColumnActualStatus', order: 7 },
    { key: 'result', label: '', labelKey: 'module.reportsColumnInventoryResult', order: 8 },
    { key: 'inventory_date', label: '', labelKey: 'module.reportsColumnInventoryDate', order: 9 },
    { key: 'notes', label: '', labelKey: 'module.reportsColumnNotes', order: 10 },
  ],`,
    '5/6 Web: عمودا الحالة في تقرير الجرد');
  if (web1) ok++;

  // 6) Web — default profile + i18n (EN/AR)
  if (patchFile(root,
    'web/src/app/(dashboard)/reports/page.tsx',
    "inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode'],",
    "inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode', 'actual_status_name'],",
    '6a/6 Web: عمود الحالة في قالب الجرد الافتراضي')) ok++;
  const enOut = patchFile(root, 'web/src/lib/i18n.tsx',
    "'module.reportsColumnActualQuantity': 'Actual quantity', 'module.reportsColumnInventoryResult'",
    "'module.reportsColumnActualQuantity': 'Actual quantity', 'module.reportsColumnExpectedStatus': 'Expected status', 'module.reportsColumnActualStatus': 'Actual status', 'module.reportsColumnInventoryResult'",
    '6b/6 Web: ترجمة EN');
  const arOut = patchFile(root, 'web/src/lib/i18n.tsx',
    "'module.reportsColumnActualQuantity': 'الكمية الفعلية', 'module.reportsColumnInventoryResult'",
    "'module.reportsColumnActualQuantity': 'الكمية الفعلية', 'module.reportsColumnExpectedStatus': 'الحالة المتوقعة', 'module.reportsColumnActualStatus': 'الحالة الفعلية', 'module.reportsColumnInventoryResult'",
    '6c/6 Web: ترجمة AR');
  if (enOut) ok++;
  if (arOut) ok++;

  console.log('---');
  console.log(ok === 8 ? 'الانتهاء: تم تطبيق الإصلاحات الثمانية بنجاح. أعد تشغيل النوافذ الثلاث (StartX.bat).'
                       : 'الانتهاء مع ملاحظات: طُبّق ' + ok + ' من 8 — بعض المواضع لم تُطبق (MISS) — أرسل رسالة الخطأ.');
}

main();

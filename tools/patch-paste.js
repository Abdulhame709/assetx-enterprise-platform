// AssetX fix: inventory result MATCHED + actual status column in report. Run: node patch-paste.js
const fs = require('fs');
const path = require('path');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
function rd(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function patch(r, rel, oldS, newS, lbl) {
  const p = path.join(r, rel);
  if (!fs.existsSync(p)) { console.log('MISS ' + lbl + ' (missing file)'); return false; }
  let t = rd(p);
  if (t.includes(newS)) { console.log('ALREADY ' + lbl); return true; }
  if (!t.includes(oldS)) { console.log('MISS ' + lbl + ' (anchor not found)'); return false; }
  const bak = p + '.bak-syncfix';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, t, 'utf8');
  fs.writeFileSync(p, t.split(oldS).join(newS), 'utf8');
  console.log('OK ' + lbl);
  return true;
}
const R = root();
if (!R) { console.log('ERROR: project root not found (web/ + backend/ must be nearby)'); process.exit(2); }
console.log('ROOT: ' + R);
let ok = 0;
if (patch(R, 'Mobile/AssetXMobile/app/inventory/[cycleId]/record/[recordId].tsx',
  'actual_quantity: actualQuantity, actual_status_id: actualStatusId, notes: combinedNotes',
  'actual_quantity: actualQuantity, actual_location_id: record.actual_location_id ?? record.expected_location_id, actual_status_id: actualStatusId, notes: combinedNotes',
  '1/8 mobile location')) ok++;
const oldSql = '    const { rows } = await this.db.query<InventoryRecordResult>(\n      `SELECT * FROM v_inventory_result WHERE cycle_id = $1 ORDER BY id`,\n      [cycleId],\n    );';
const newSql = '    // read status ids from inventory_records (view lacks them) and join status names for reports.\n    const { rows } = await this.db.query<InventoryRecordResult>(\n      `SELECT\n         ir.id, ir.tenant_id, ir.cycle_id, ir.asset_id,\n         ir.expected_location_id, ir.expected_quantity, ir.expected_status_id,\n         ir.expected_employee_id, ir.actual_location_id, ir.actual_quantity,\n         ir.actual_status_id, ir.actual_employee_id,\n         ir.inventory_date, ir.inventory_by, ir.is_verified, ir.verified_by,\n         ir.verified_date, ir.notes, ir.created_at, ir.updated_at,\n         vw.result,\n         es.name AS expected_status_name,\n         ast.name AS actual_status_name\n       FROM inventory_records ir\n       JOIN v_inventory_result vw ON vw.id = ir.id\n       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id\n       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id\n       WHERE ir.cycle_id = $1\n       ORDER BY ir.id`,\n      [cycleId],\n    );';
if (patch(R, 'backend/src/infrastructure/repositories/result.repository.ts', oldSql, newSql, '2/8 result query')) ok++;
if (patch(R, 'backend/src/core/entities/inventory.entity.ts',
  'export interface InventoryRecordResult extends InventoryRecord {\n  result: InventoryResult;\n}',
  'export interface InventoryRecordResult extends InventoryRecord {\n  result: InventoryResult;\n  expected_status_name?: string | null;\n  actual_status_name?: string | null;\n}',
  '3/8 entity type')) ok++;
if (patch(R, 'backend/src/application/export/export-profile.registry.ts',
  "          { key: 'barcode', label: 'Barcode', order: 6 },\n        ],\n      },\n      compliance: {",
  "          { key: 'barcode', label: 'Barcode', order: 6 },\n          { key: 'actual_status_name', label: 'Actual Status', order: 7 },\n        ],\n      },\n      compliance: {",
  '4/8 export profile')) ok++;
if (patch(R, 'web/src/app/(dashboard)/reports/page.tsx',
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
  '5/8 web columns')) ok++;
if (patch(R, 'web/src/app/(dashboard)/reports/page.tsx',
  "inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode'],",
  "inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode', 'actual_status_name'],",
  '6/8 web profile')) ok++;
if (patch(R, 'web/src/lib/i18n.tsx',
  "'module.reportsColumnActualQuantity': 'Actual quantity', 'module.reportsColumnInventoryResult'",
  "'module.reportsColumnActualQuantity': 'Actual quantity', 'module.reportsColumnExpectedStatus': 'Expected status', 'module.reportsColumnActualStatus': 'Actual status', 'module.reportsColumnInventoryResult'",
  '7/8 i18n EN')) ok++;
if (patch(R, 'web/src/lib/i18n.tsx',
  "'module.reportsColumnActualQuantity': 'الكمية الفعلية', 'module.reportsColumnInventoryResult'",
  "'module.reportsColumnActualQuantity': 'الكمية الفعلية', 'module.reportsColumnExpectedStatus': 'الحالة المتوقعة', 'module.reportsColumnActualStatus': 'الحالة الفعلية', 'module.reportsColumnInventoryResult'",
  '8/8 i18n AR')) ok++;
console.log(ok === 8 ? 'SUCCESS: all 8 fixes applied. Restart the 3 windows (StartX.bat).' : 'PARTIAL: applied ' + ok + '/8 - send this output.');

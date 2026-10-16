/**
 * AssetX — READ-ONLY whole-database report: "one clean name = one base code".
 *
 * For every tenant it groups the ACTIVE assets by their clean name (spaces,
 * hamza/alef forms, ya/alef-maqsura, ta-marbuta/ha, diacritics and a legacy
 * "(2025-0038-13@...)" suffix are ignored — the same folding the system now uses
 * when an asset is created) and reports:
 *   1. names that carry MORE THAN ONE base code  (the problem to fix)
 *   2. how many records each name has and what makes them differ
 *      (location / type / status / holder / notes)
 *   3. fully identical records (same on all of the above) — the only ones that
 *      may ever be merged (quantities added together)
 *
 * SAFETY: runs inside a READ ONLY transaction that is always rolled back.
 * It cannot insert, update or delete anything. It never prints secrets.
 *
 * Run from the project root:   node tools/db-cleanup/report-name-codes.js
 * Output: console summary + two files in tools/db-cleanup/out/ (open in Excel):
 *   name-codes-groups.csv   one line per clean name
 *   name-codes-records.csv  one line per asset record
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const env = {};
const envPath = path.join(root, 'backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

// Same rules as foldAssetName() in backend/src/application/asset-algorithms.ts.
const INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN = '۰۱۲۳۴۵۶۷۸۹';
function fold(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN.indexOf(d)))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// Trailing "( ... 2025-0038 ... )" left by the old importer.
const CODED_SUFFIX = /\s*\(([^()]*\b\d{4}-\d{1,6}[^()]*)\)\s*$/;
const cleanName = (name) => String(name || '').replace(CODED_SUFFIX, '').trim();

const SQL = `
  SELECT a.id, a.name, a.base_asset_code, a.full_asset_code, a.quantity, a.notes,
         a.location_id, a.category_id, a.status_id, a.employee_id,
         l.full_path AS location, c.name AS category, s.name AS status, e.name AS holder,
         (SELECT count(*)::int FROM asset_movements m WHERE m.asset_id = a.id) AS movements,
         (SELECT count(*)::int FROM inventory_records r WHERE r.asset_id = a.id) AS inventory_records,
         (SELECT count(*)::int FROM maintenance_orders o WHERE o.asset_id = a.id) AS maintenance
  FROM assets a
  LEFT JOIN locations l ON l.id = a.location_id
  LEFT JOIN asset_categories c ON c.id = a.category_id
  LEFT JOIN statuses s ON s.id = a.status_id
  LEFT JOIN employees e ON e.id = a.employee_id
  WHERE a.tenant_id = $1 AND a.is_active = true
  ORDER BY a.base_asset_code, a.name`;

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formulas
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const writeCsv = (file, rows) =>
  fs.writeFileSync(file, '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');

const distinct = (rows, pick) => [...new Set(rows.map(pick))];

async function main() {
  if (!env.DATABASE_URL) {
    console.log('لا يوجد DATABASE_URL في backend/.env — لا توجد قاعدة محلية للفحص.');
    return;
  }
  const pg = require(path.join(root, 'backend', 'node_modules', 'pg'));
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    console.log('تعذر الاتصال بقاعدة البيانات:', String(err.message || err));
    process.exitCode = 1;
    return;
  }

  const groupRows = [[
    'المستأجر', 'الاسم النظيف', 'عدد السجلات', 'عدد الأكواد الأساسية', 'الأكواد الأساسية', 'الكود الذي سيُعتمد (الأقدم)',
    'مواقع مختلفة', 'أنواع مختلفة', 'حالات مختلفة', 'مستلمون مختلفون', 'ملاحظات مختلفة',
    'سجلات متطابقة تماماً (قابلة للدمج)', 'مجموع الكميات', 'حركات', 'سجلات جرد', 'صيانة', 'أسماء مكتوبة بصيغ مختلفة',
  ]];
  const recordRows = [[
    'المستأجر', 'الاسم النظيف', 'الاسم الحالي', 'الكود الأساسي الحالي', 'الكود الذي سيُعتمد', 'يحتاج تغيير كود',
    'الموقع', 'النوع', 'الحالة', 'المستلم', 'الكمية', 'الملاحظات', 'مجموعة التطابق التام', 'حركات', 'سجلات جرد', 'صيانة',
  ]];

  try {
    await client.query('BEGIN READ ONLY');
    const tenants = (await client.query('SELECT id, tenant_code, name FROM tenants ORDER BY tenant_code')).rows;
    const totals = { assets: 0, names: 0, multi: 0, toRecode: 0, identicalGroups: 0, identicalExtra: 0, spellings: 0 };

    for (const tenant of tenants) {
      await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenant.id]);
      const assets = (await client.query(SQL, [tenant.id])).rows;

      const byName = new Map();
      for (const a of assets) {
        const key = fold(cleanName(a.name));
        if (!key) continue;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(a);
      }

      const groups = [...byName.values()];
      const multi = groups.filter((g) => distinct(g, (a) => a.base_asset_code).length > 1);
      const spellingVariants = groups.filter((g) => distinct(g, (a) => String(a.name).trim()).length > 1);
      let toRecode = 0;
      let identicalGroups = 0;
      let identicalExtra = 0;

      for (const g of groups) {
        const codes = distinct(g, (a) => a.base_asset_code).filter(Boolean).sort();
        const keep = codes[0] || '';
        // identical = same on name, location, type, status, holder and notes
        const sig = (a) => [fold(cleanName(a.name)), a.location_id, a.category_id, a.status_id, a.employee_id, fold(a.notes)].join('|');
        const clusters = new Map();
        for (const a of g) {
          const k = sig(a);
          if (!clusters.has(k)) clusters.set(k, []);
          clusters.get(k).push(a);
        }
        const identical = [...clusters.values()].filter((c) => c.length > 1);
        identicalGroups += identical.length;
        identicalExtra += identical.reduce((n, c) => n + c.length - 1, 0);
        const clusterId = new Map();
        identical.forEach((c, i) => c.forEach((a) => clusterId.set(a.id, `${tenant.tenant_code}-${groupRows.length}-${i + 1}`)));

        const sum = (f) => g.reduce((n, a) => n + Number(a[f] || 0), 0);
        groupRows.push([
          tenant.tenant_code, cleanName(g[0].name), g.length, codes.length, codes.join(' | '), keep,
          distinct(g, (a) => a.location_id).length, distinct(g, (a) => a.category_id).length,
          distinct(g, (a) => a.status_id).length, distinct(g, (a) => a.employee_id).length,
          distinct(g, (a) => fold(a.notes)).length,
          identical.length ? identical.map((c) => `${c.length} سجلات`).join(' + ') : '',
          sum('quantity'), sum('movements'), sum('inventory_records'), sum('maintenance'),
          distinct(g, (a) => String(a.name).trim()).length > 1 ? distinct(g, (a) => String(a.name).trim()).join(' | ') : '',
        ]);
        for (const a of g) {
          const needs = a.base_asset_code !== keep;
          if (needs) toRecode += 1;
          recordRows.push([
            tenant.tenant_code, cleanName(g[0].name), a.name, a.base_asset_code, keep, needs ? 'نعم' : '',
            a.location || '', a.category || '', a.status || '', a.holder || '', a.quantity, a.notes || '',
            clusterId.get(a.id) || '', a.movements, a.inventory_records, a.maintenance,
          ]);
        }
      }

      totals.assets += assets.length;
      totals.names += groups.length;
      totals.multi += multi.length;
      totals.toRecode += toRecode;
      totals.identicalGroups += identicalGroups;
      totals.identicalExtra += identicalExtra;
      totals.spellings += spellingVariants.length;

      console.log('═'.repeat(60));
      console.log(`المستأجر: ${tenant.tenant_code} (${tenant.name})`);
      console.log(`  الأصول النشطة: ${assets.length}`);
      console.log(`  الأسماء النظيفة المختلفة: ${groups.length}`);
      console.log(`  أسماء لها أكثر من كود أساسي (المشكلة): ${multi.length}`);
      console.log(`  سجلات سيتغيّر كودها الأساسي لتوحيده: ${toRecode}`);
      console.log(`  أسماء مكتوبة بأكثر من صيغة (همزة/مسافات/ة...): ${spellingVariants.length}`);
      console.log(`  مجموعات سجلات متطابقة تماماً: ${identicalGroups} (سجلات زائدة يمكن دمجها: ${identicalExtra})`);

      const worst = multi.slice().sort((x, y) => y.length - x.length).slice(0, 15);
      if (worst.length) {
        console.log('\n  أكثر 15 اسماً تكراراً بأكواد مختلفة:');
        for (const g of worst) {
          const codes = distinct(g, (a) => a.base_asset_code).sort();
          console.log(`   • ${cleanName(g[0].name)} — ${g.length} سجل، ${codes.length} أكواد (${codes.slice(0, 4).join('، ')}${codes.length > 4 ? '…' : ''})`);
        }
      }
    }

    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const groupsFile = path.join(outDir, 'name-codes-groups.csv');
    const recordsFile = path.join(outDir, 'name-codes-records.csv');
    writeCsv(groupsFile, groupRows);
    writeCsv(recordsFile, recordRows);

    console.log('═'.repeat(60));
    console.log(`الإجمالي: ${totals.assets} أصلاً نشطاً، ${totals.names} اسماً نظيفاً.`);
    console.log(`أسماء بأكثر من كود: ${totals.multi} — سجلات يلزمها توحيد كود: ${totals.toRecode}`);
    console.log(`سجلات متطابقة تماماً قابلة للدمج: ${totals.identicalExtra} (في ${totals.identicalGroups} مجموعة)`);
    console.log(`ملف الأسماء:  ${groupsFile}`);
    console.log(`ملف السجلات: ${recordsFile}`);
    console.log('انتهى — لم يُنفَّذ أي تعديل (المعاملة للقراءة فقط وتُلغى دائماً).');
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be closed */ }
    await client.end();
  }
}

main().catch((err) => {
  console.log('خطأ:', String(err && err.message));
  process.exitCode = 1;
});

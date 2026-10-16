/**
 * AssetX — READ-ONLY report of assets whose NAME ends with a legacy code in
 * parentheses, e.g.  "كراسي أبو يدين (2025-0038-13@الألعاب-وشبوكات-العاب)".
 * (The old data importer appended the legacy code to the name when two assets
 * shared the same name in the same location.)
 *
 * For each such asset it shows whether a twin with the clean name (same
 * location) exists, plus the facts needed to decide between merging and
 * keeping both: quantity, status, price, movements, inventory records,
 * maintenance orders.
 *
 * SAFETY: runs inside a READ ONLY transaction that is always rolled back.
 * It cannot insert, update or delete anything. It never prints secrets.
 *
 * Run from the project root:   node tools/db-cleanup/list-coded-names.js
 * Output: console summary + tools/db-cleanup/out/coded-names.csv (open in Excel)
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

// Trailing "( ... 2025-0038 ... )" — a year-number code, optionally with @location.
const CODED_SUFFIX = /\s*\(([^()]*\b\d{4}-\d{1,6}[^()]*)\)\s*$/;
const norm = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const SQL = `
  SELECT a.id, a.name, a.base_asset_code, a.full_asset_code, a.quantity, a.purchase_price,
         a.serial_number, a.is_active, a.location_id,
         s.name AS status, l.full_path AS location,
         (SELECT count(*)::int FROM asset_movements m WHERE m.asset_id = a.id) AS movements,
         (SELECT count(*)::int FROM inventory_records r WHERE r.asset_id = a.id) AS inventory_records,
         (SELECT count(*)::int FROM maintenance_orders o WHERE o.asset_id = a.id) AS maintenance
  FROM assets a
  LEFT JOIN statuses s ON s.id = a.status_id
  LEFT JOIN locations l ON l.id = a.location_id
  WHERE a.tenant_id = $1
  ORDER BY l.full_path, a.name`;

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

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

  const csvRows = [];
  const header = ['الحالة', 'الاسم الحالي', 'الاسم بدون الكود', 'الكود القديم داخل الاسم', 'الموقع', 'الكود الجديد',
    'الكمية', 'الحالة التشغيلية', 'سعر الشراء', 'الرقم التسلسلي', 'حركات', 'سجلات جرد', 'صيانة', 'كمية التوأم', 'كود التوأم', 'نشط'];
  csvRows.push(header);

  try {
    await client.query('BEGIN READ ONLY');
    const tenants = (await client.query('SELECT id, tenant_code, name FROM tenants ORDER BY tenant_code')).rows;
    let totalCoded = 0;
    let totalTwins = 0;

    for (const tenant of tenants) {
      await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenant.id]);
      const assets = (await client.query(SQL, [tenant.id])).rows;

      const byKey = new Map();
      for (const a of assets) {
        const key = `${norm(a.name)}|${a.location_id || ''}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(a);
      }

      const coded = [];
      for (const a of assets) {
        const m = String(a.name).match(CODED_SUFFIX);
        if (!m) continue;
        const cleanName = String(a.name).replace(CODED_SUFFIX, '').trim();
        const twins = (byKey.get(`${norm(cleanName)}|${a.location_id || ''}`) || []).filter((t) => t.id !== a.id);
        const otherLocation = assets.filter((t) => t.id !== a.id && t.location_id !== a.location_id && norm(t.name) === norm(cleanName));
        coded.push({ a, cleanName, legacy: m[1].trim(), twin: twins[0] || null, otherLocation });
      }

      const withTwin = coded.filter((c) => c.twin);
      totalCoded += coded.length;
      totalTwins += withTwin.length;

      console.log('═'.repeat(60));
      console.log(`المستأجر: ${tenant.tenant_code} (${tenant.name}) — إجمالي الأصول ${assets.length}`);
      console.log(`أصول باسم يحمل كوداً قديماً: ${coded.length}`);
      console.log(`  • لها توأم بنفس الاسم النظيف في نفس الموقع (مرشّحة للدمج): ${withTwin.length}`);
      console.log(`  • بلا توأم في الموقع (الاسم فقط يحتاج تنظيفاً): ${coded.length - withTwin.length}`);

      for (const c of coded) {
        const status = c.twin ? 'له توأم' : (c.otherLocation.length ? 'توأم في موقع آخر' : 'بلا توأم');
        csvRows.push([
          status, c.a.name, c.cleanName, c.legacy, c.a.location || '', c.a.full_asset_code,
          c.a.quantity, c.a.status || '', c.a.purchase_price, c.a.serial_number || '',
          c.a.movements, c.a.inventory_records, c.a.maintenance,
          c.twin ? c.twin.quantity : '', c.twin ? c.twin.full_asset_code : '', c.a.is_active ? 'نعم' : 'لا',
        ]);
      }

      if (withTwin.length) {
        console.log('\nأمثلة (أول 15) من الأصول التي لها توأم:');
        for (const c of withTwin.slice(0, 15)) {
          console.log(`  • ${c.cleanName} — ${c.a.location || 'بدون موقع'}`);
          console.log(`      السجل الأول: ${c.twin.full_asset_code} | كمية ${c.twin.quantity} | حركات ${c.twin.movements} | جرد ${c.twin.inventory_records}`);
          console.log(`      السجل ذو الكود: ${c.a.full_asset_code} | كمية ${c.a.quantity} | حركات ${c.a.movements} | جرد ${c.a.inventory_records} | الكود القديم: ${c.legacy}`);
        }
      }
    }

    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'coded-names.csv');
    fs.writeFileSync(outFile, '﻿' + csvRows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');

    console.log('═'.repeat(60));
    console.log(`الإجمالي: ${totalCoded} أصلاً باسم فيه كود قديم، منها ${totalTwins} لها توأم.`);
    console.log(`الملف الكامل (افتحه في Excel): ${outFile}`);
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

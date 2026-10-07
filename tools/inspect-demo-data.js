/**
 * AssetX — read-only inventory of local PostgreSQL data (compact).
 * Shows every row classified as:  تجريبي-DEMO | اختباري-TEST | مرجعي-KEEP | أخرى
 * NEVER writes/deletes. Never prints secrets.
 * Run from project root:  node inspect-demo-data.js
 */
const fs = require('fs');
const path = require('path');

function findRoot() {
  for (const cand of [__dirname, path.join(__dirname, '..')]) {
    if (fs.existsSync(path.join(cand, 'backend', '.env'))) return cand;
  }
  return path.dirname(__dirname);
}
const root = findRoot();
const envPath = path.join(root, 'backend', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
}

const url = env.DATABASE_URL;
const bar20 = '━'.repeat(20);
let client;

const Q = {
  tenants: 'SELECT id, tenant_code, name, status FROM tenants ORDER BY tenant_code',
  users: 'SELECT username, is_active FROM users WHERE tenant_id=$1 ORDER BY username',
  roles: 'SELECT name FROM roles WHERE tenant_id=$1 ORDER BY name',
  statuses: 'SELECT name, color, is_active FROM statuses WHERE tenant_id=$1 ORDER BY name',
  categories: 'SELECT name FROM asset_categories WHERE tenant_id=$1 ORDER BY name',
  models: (
    'SELECT am.name, c.name AS cat FROM asset_models am ' +
    'JOIN asset_categories c ON c.id=am.category_id ' +
    'WHERE am.tenant_id=$1 ORDER BY am.name'
  ),
  locations: 'SELECT name, path, full_path, is_active FROM locations WHERE tenant_id=$1 ORDER BY path',
  employees: 'SELECT name, department, email, is_active FROM employees WHERE tenant_id=$1 ORDER BY name',
  assets: (
    'SELECT a.name, a.full_asset_code, a.serial_number, a.barcode, a.reference_number, ' +
    'a.quantity, a.is_active, s.name AS st, l.full_path AS loc, e.name AS emp FROM assets a ' +
    'LEFT JOIN statuses s ON s.id=a.status_id AND s.tenant_id=a.tenant_id ' +
    'LEFT JOIN locations l ON l.id=a.location_id AND l.tenant_id=a.tenant_id ' +
    'LEFT JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id ' +
    'WHERE a.tenant_id=$1 ORDER BY a.base_asset_code'
  ),
  cycles: 'SELECT year, status, start_date FROM inventory_cycles WHERE tenant_id=$1 ORDER BY year',
  records: (
    'SELECT c.year, count(*)::int AS n FROM inventory_records r ' +
    'JOIN inventory_cycles c ON c.id=r.cycle_id ' +
    'WHERE r.tenant_id=$1 GROUP BY c.year ORDER BY c.year'
  ),
  movements: (
    'SELECT m.movement_type, m.status, m.reference_number, left(coalesce(m.reason,\'\'),40) AS reason, ' +
    'to_char(m.created_at,\'YYYY-MM-DD HH24:MI\') AS created, a.full_asset_code AS code ' +
    'FROM asset_movements m JOIN assets a ON a.id=m.asset_id AND a.tenant_id=m.tenant_id ' +
    'WHERE m.tenant_id=$1 ORDER BY m.created_at DESC LIMIT 40'
  ),
  notifications: 'SELECT count(*)::int AS n FROM notifications WHERE tenant_id=$1',
  audit: 'SELECT action_type, count(*)::int AS n FROM audit_events WHERE tenant_id=$1 GROUP BY action_type ORDER BY n DESC',
};

function flagAsset(row) {
  const hay = String(row.name || '') + ' ' + String(row.serial_number || '') + ' ' +
    String(row.barcode || '') + ' ' + String(row.reference_number || '');
  if (/DEMO/i.test(hay)) return 'تجريبي-DEMO';
  if (/تجريبي|اختبار|TEST/i.test(hay)) return 'اختباري-TEST';
  return 'أخرى-OTHER';
}
function flagLocation(row) {
  const hay = String(row.path || '') + ' ' + String(row.full_path || '') + ' ' + String(row.name || '');
  if (/^hq(\b|\.)|^warehouse(\b|\.)/i.test(String(row.path || ''))) return 'تجريبي-DEMO';
  if (/تجريبي|اختبار|TEST/i.test(hay)) return 'اختباري-TEST';
  return 'أخرى-OTHER';
}
function flagEmployee(row) {
  const hay = String(row.name || '') + ' ' + String(row.email || '') + ' ' + String(row.department || '');
  if (/@assetx\.io$/i.test(String(row.email || '')) ||
    /Sara|Omar|Layla|Khalid|Noura|Tariq/i.test(String(row.name || ''))) return 'تجريبي-DEMO';
  if (/تجريبي|اختبار|TEST/i.test(hay)) return 'اختباري-TEST';
  return 'أخرى-OTHER';
}

async function main() {
  if (!url) {
    console.log('لا يوجد DATABASE_URL في backend/.env → الخادم يعمل بوضع PGlite');
    console.log('(بيانات مؤقتة تختفي عند الإيقاف — لا حاجة للتنظيف)');
    return;
  }
  const pg = require(path.join(root, 'backend', 'node_modules', 'pg'));
  client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    console.log('تعذر الاتصال بقاعدة البيانات:', String(err.message || err));
    return;
  }

  const tenants = (await client.query(Q.tenants)).rows;
  console.log('المستأجرون (' + tenants.length + '):');
  for (const t of tenants) console.log('  • ' + t.tenant_code + ' — ' + t.name + ' [' + t.status + ']');
  if (!tenants.length) {
    console.log('لا يوجد مستأجرون. انتهى الجرد (لا تعديل).');
    await client.end();
    return;
  }

  for (const t of tenants) {
    await client.query('SELECT set_config($1,$2,false)', ['app.tenant_id', t.id]);
    const tid = t.id;
    const rows = async (sql) => (await client.query(sql, [tid])).rows;

    const counts = {
      users: (await rows('SELECT count(*)::int AS c FROM users WHERE tenant_id=$1'))[0].c,
      employees: (await rows('SELECT count(*)::int AS c FROM employees WHERE tenant_id=$1'))[0].c,
      statuses: (await rows('SELECT count(*)::int AS c FROM statuses WHERE tenant_id=$1'))[0].c,
      locations: (await rows('SELECT count(*)::int AS c FROM locations WHERE tenant_id=$1'))[0].c,
      categories: (await rows('SELECT count(*)::int AS c FROM asset_categories WHERE tenant_id=$1'))[0].c,
      models: (await rows('SELECT count(*)::int AS c FROM asset_models WHERE tenant_id=$1'))[0].c,
      assets: (await rows('SELECT count(*)::int AS c FROM assets WHERE tenant_id=$1'))[0].c,
      movements: (await rows('SELECT count(*)::int AS c FROM asset_movements WHERE tenant_id=$1'))[0].c,
      cycles: (await rows('SELECT count(*)::int AS c FROM inventory_cycles WHERE tenant_id=$1'))[0].c,
      records: (await rows('SELECT count(*)::int AS c FROM inventory_records WHERE tenant_id=$1'))[0].c,
      notifications: (await rows('SELECT count(*)::int AS c FROM notifications WHERE tenant_id=$1'))[0].c,
      audit: (await rows('SELECT count(*)::int AS c FROM audit_events WHERE tenant_id=$1'))[0].c,
    };

    console.log('');

    console.log((bar20+bar20));
    console.log('المستأجر: ' + t.tenant_code + ' (' + t.name + ')');
    console.log('الملخص — أصول=' + counts.assets + ' حركات=' + counts.movements +
      ' دورات=' + counts.cycles + ' سجلات=' + counts.records + ' موظفون=' + counts.employees +
      ' مواقع=' + counts.locations + ' حالات=' + counts.statuses + ' إشعارات=' + counts.notifications);

    const users = await rows(Q.users);
    console.log('\nالمستخدمون (' + users.length + '):');
    for (const u of users) console.log('  • ' + u.username + (u.is_active ? '' : ' [معطل]'));

    const roles = await rows(Q.roles);
    console.log('\nالأدوار: ' + roles.map((r) => r.name).join(', '));

    const statuses = await rows(Q.statuses);
    console.log('\nالحالات:');
    for (const s of statuses) {
      console.log('  • ' + s.name + '   [' + (/^Good$|^Maintenance$/.test(s.name) ? 'مرجعي-KEEP' : 'أخرى-OTHER') + ']');
    }

    const cats = await rows(Q.categories);
    const models = await rows(Q.models);
    console.log('\nالفئات: ' + cats.map((c) => c.name).join(', '));
    console.log('الطرازات: ' + models.map((m) => m.name + '(' + m.cat + ')').join(', '));

    const locs = await rows(Q.locations);
    console.log('\nالمواقع (' + locs.length + '):');
    for (const l of locs) console.log('  • ' + l.full_path + '   [' + flagLocation(l) + ']');

    const emps = await rows(Q.employees);
    console.log('\nالموظفون (' + emps.length + '):');
    for (const e of emps) {
      console.log('  • ' + e.name + (e.department ? ' — ' + e.department : '') +
        (e.email ? ' <' + e.email + '>' : '') + '   [' + flagEmployee(e) + ']');
    }

    const assets = await rows(Q.assets);
    console.log('\nالأصول (' + assets.length + '):');
    for (const a of assets) {
      console.log('  • ' + a.name + ' | ' + a.full_asset_code +
        (a.serial_number ? ' | SN:' + a.serial_number : '') +
        (a.barcode ? ' | BC:' + a.barcode : '') +
        ' | ' + (a.st || 'بدون حالة') + ' | ' + (a.loc || 'بدون موقع') +
        (a.emp ? ' | ' + a.emp : '') + '   [' + flagAsset(a) + ']');
    }

    const cycles = await rows(Q.cycles);
    const records = await rows(Q.records);
    console.log('\nدورات الجرد (' + cycles.length + '):');
    for (const c of cycles) {
      const n = records.find((r) => r.year === c.year)?.n ?? 0;
      console.log('  • سنة ' + c.year + ' [' + c.status + '] سجلات=' + n);
    }

    const moves = await rows(Q.movements);
    console.log('\nأحدث الحركات (' + moves.length + '):');
    for (const m of moves) {
      const kind = /DEMO/i.test(String(m.reference_number || '')) ? 'تجريبي-DEMO' : 'أخرى-OTHER';
      console.log('  • ' + m.code + ' | ' + m.movement_type + ' | ' + m.status +
        ' | ' + (m.reference_number || '-') + ' | ' + m.created + ' | ' + m.reason + '   [' + kind + ']');
    }

    const note = (await rows(Q.notifications))[0];
    const audit = await rows(Q.audit);
    console.log('\nالإشعارات: ' + (note ? note.n : 0));
    console.log('أحداث التدقيق: ' + audit.map((a) => a.action_type + '=' + a.n).join(' | '));
  }

  await client.end();
  console.log('');
  console.log((bar20+bar20));
  console.log('انتهى الجرد — لم يُنفَّذ أي تعديل.');
}

if (require.main === module) {
  main().catch((err) => {
    console.log('خطأ:', String(err && err.message));
    process.exitCode = 1;
  });
}

module.exports = { flagAsset, flagLocation, flagEmployee };

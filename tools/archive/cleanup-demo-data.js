/** AssetX — تنظيف بيانات الاختبار المحلية (مع نسخة احتياطية JSON أولاً).
 *  يحذف فقط: أصول الاختبار + مواقع "تجريبي" + دورتي 2026/2027 + حركاتها + إشعاراتها.
 *  يُبقي: المستخدمين/الموظفين/الأدوار/الحالات/الفئات/المواقع المرجعية/التدقيق.
 *  التشغيل من جذر المشروع:  node cleanup-demo-data.js */
const fs = require('fs');
const path = require('path');

function findRoot() {
  for (const cand of [__dirname, path.join(__dirname, '..')]) {
    if (fs.existsSync(path.join(cand, 'backend', '.env'))) return cand;
  }
  return path.dirname(__dirname);
}
function readEnv(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function run() {
  const root = findRoot();
  const url = readEnv(path.join(root, 'backend', '.env')).DATABASE_URL;
  if (!url) {
    console.log('لا يوجد DATABASE_URL في backend/.env → يعمل بوضع PGlite مؤقت (لا حاجة للتنظيف).');
    return;
  }
  const pg = require(path.join(root, 'backend', 'node_modules', 'pg'));
  const client = new pg.Client({ connectionString: url });
  try { await client.connect(); } catch (err) {
    console.log('تعذر الاتصال بقاعدة البيانات:', String(err && err.message));
    return;
  }

  let backup = null;
  const totals = { records: 0, cycles: 0, movements: 0, assets: 0, locations: 0, notifications: 0 };
  try {
    await client.query('BEGIN');
    const tenants = (await client.query(
      'SELECT id, tenant_code, name FROM tenants ORDER BY tenant_code')).rows;
    if (!tenants.length) {
      await client.query('ROLLBACK');
      console.log('لا يوجد مستأجرون — لا شيء للحذف.');
      await client.end();
      return;
    }

    for (const t of tenants) {
      await client.query('SELECT set_config($1,$2,false)', ['app.tenant_id', t.id]);
      const tid = t.id;
      const q = async (sql, params) => (await client.query(sql, params)).rows;

      // 1) مواقع الاختبار (بما فيها أبناؤها)
      const locRows = await q(
        'SELECT id, name, path, full_path, parent_id FROM locations ' +
        "WHERE tenant_id=$1 AND (name LIKE '%تجريبي%' OR path LIKE '%تجريبي%' " +
        "OR full_path LIKE '%تجريبي%') ORDER BY path", [tid]);
      const locIds = new Set(locRows.map((r) => r.id));
      let grew = true;
      while (grew) {
        grew = false;
        const kids = await q(
          'SELECT id, name, path, full_path, parent_id FROM locations ' +
          'WHERE tenant_id=$1 AND parent_id=ANY($2::uuid[]) ORDER BY path',
          [tid, [...locIds]]);
        for (const r of kids) {
          if (!locIds.has(r.id)) { locIds.add(r.id); locRows.push(r); grew = true; }
        }
      }

      // 2) أصول الاختبار
      const assetRows = await q(
        'SELECT a.id, a.name, a.full_asset_code FROM assets a ' +
        'LEFT JOIN locations l ON l.id=a.location_id WHERE a.tenant_id=$1 AND ' +
        "(l.id=ANY($2::uuid[]) OR a.serial_number ILIKE '%TEST%' OR " +
        "a.barcode ILIKE '%TEST%' OR a.name LIKE '%اختبار%') ORDER BY a.full_asset_code",
        [tid, [...locIds]]);
      const assetIds = assetRows.map((r) => r.id);

      // 3) دورات الاختبار (2026/2027 جديدة أو تحوي سجلات لأصول الاختبار)
      const cycleRows = await q(
        'SELECT c.id, c.year FROM inventory_cycles c WHERE c.tenant_id=$1 AND ' +
        "((c.year IN (2026,2027) AND c.status='new') OR EXISTS (" +
        'SELECT 1 FROM inventory_records r WHERE r.cycle_id=c.id AND r.tenant_id=$1 ' +
        'AND r.asset_id=ANY($2::uuid[]))) ORDER BY c.year', [tid, assetIds]);
      const cycleIds = cycleRows.map((r) => r.id);

      // 4) سجلات الجرد لتلك الدورات
      const recRows = cycleIds.length
        ? await q('SELECT id FROM inventory_records WHERE tenant_id=$1 ' +
          'AND cycle_id=ANY($2::uuid[])', [tid, cycleIds]) : [];
      const recIds = recRows.map((r) => r.id);

      // 5) حركات أصول الاختبار
      const movRows = assetIds.length
        ? await q('SELECT id, status FROM asset_movements WHERE tenant_id=$1 ' +
          'AND asset_id=ANY($2::uuid[]) ORDER BY created_at', [tid, assetIds]) : [];
      const movIds = movRows.map((r) => r.id);

      // 6) إشعارات المستأجر
      const notifRows = await q(
        'SELECT id FROM notifications WHERE tenant_id=$1 ORDER BY created_at', [tid]);
      const notifIds = notifRows.map((r) => r.id);

      // النسخة الاحتياطية قبل أي حذف
      backup = {
        createdAt: new Date().toISOString(), tenant: t.tenant_code,
        tables: { assets: assetRows, locations: locRows, cycles: cycleRows,
          records: recRows, movements: movRows, notifications: notifRows },
      };

      // الحذف بترتيب آمن لقيود المفاتيح الأجنبية
      if (recIds.length) {
        totals.records += (await client.query(
          'DELETE FROM inventory_records WHERE id=ANY($1::uuid[])', [recIds])).rowCount;
      }
      if (cycleIds.length) {
        totals.cycles += (await client.query(
          'DELETE FROM inventory_cycles WHERE id=ANY($1::uuid[])', [cycleIds])).rowCount;
      }
      if (movIds.length) {
        totals.movements += (await client.query(
          'DELETE FROM asset_movements WHERE id=ANY($1::uuid[])', [movIds])).rowCount;
      }
      if (assetIds.length) {
        totals.assets += (await client.query(
          'DELETE FROM assets WHERE id=ANY($1::uuid[])', [assetIds])).rowCount;
      }
      if (locIds.size) {
        const children = locRows.filter((r) => r.parent_id && locIds.has(r.parent_id))
          .map((r) => r.id);
        let childCount = 0;
        if (children.length) {
          childCount = (await client.query(
            'DELETE FROM locations WHERE id=ANY($1::uuid[])', [children])).rowCount;
        }
        const res = await client.query(
          'DELETE FROM locations WHERE id=ANY($1::uuid[])', [[...locIds]]);
        totals.locations += childCount + res.rowCount;
      }
      if (notifIds.length) {
        totals.notifications += (await client.query(
          'DELETE FROM notifications WHERE id=ANY($1::uuid[])', [notifIds])).rowCount;
      }
    }

    await client.query('COMMIT');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(root, 'assetx-backup-' + stamp + '.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

    console.log('النسخة الاحتياطية: ' + backupPath);
    console.log('تم حذف سجلات الجرد: ' + totals.records);
    console.log('تم حذف الدورات: ' + totals.cycles);
    console.log('تم حذف الحركات: ' + totals.movements);
    console.log('تم حذف الأصول: ' + totals.assets);
    console.log('تم حذف المواقع التجريبية: ' + totals.locations);
    console.log('تم حذف الإشعارات: ' + totals.notifications);

    // تحقق نهائي (الأصل المحذوفة = 0، المرجعية باقية)
    const after = { assets: 0, cycles: 0, movements: 0, testLocs: 0, users: 0, employees: 0 };
    for (const t of tenants) {
      await client.query('SELECT set_config($1,$2,false)', ['app.tenant_id', t.id]);
      after.assets += Number((await client.query(
        'SELECT count(*)::int AS c FROM assets WHERE tenant_id=$1', [t.id])).rows[0].c);
      after.cycles += Number((await client.query(
        'SELECT count(*)::int AS c FROM inventory_cycles WHERE tenant_id=$1',
        [t.id])).rows[0].c);
      after.movements += Number((await client.query(
        'SELECT count(*)::int AS c FROM asset_movements WHERE tenant_id=$1',
        [t.id])).rows[0].c);
      after.testLocs += Number((await client.query(
        "SELECT count(*)::int AS c FROM locations WHERE tenant_id=$1 AND " +
        "(name LIKE '%تجريبي%' OR path LIKE '%تجريبي%' OR full_path LIKE '%تجريبي%')",
        [t.id])).rows[0].c);
      after.users += Number((await client.query(
        'SELECT count(*)::int AS c FROM users WHERE tenant_id=$1', [t.id])).rows[0].c);
      after.employees += Number((await client.query(
        'SELECT count(*)::int AS c FROM employees WHERE tenant_id=$1', [t.id])).rows[0].c);
    }
    console.log('بعد التنظيف — أصول=' + after.assets + ' دورات=' + after.cycles +
      ' حركات=' + after.movements + ' مواقع تجريبية=' + after.testLocs);
    console.log('أُبقي — المستخدمون=' + after.users + ' الموظفون=' + after.employees);
    console.log('انتهى التنظيف بنجاح.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.log('خطأ — لم تُحذف أي بيانات:', String(err && err.message));
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.log('خطأ:', String(err && err.message));
    process.exitCode = 1;
  });
}
module.exports = { run };

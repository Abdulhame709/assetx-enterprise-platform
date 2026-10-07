// AssetX diagnostic: test the export query on the LIVE database. Run: node check-export-data.js
const fs = require('fs');
const path = require('path');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
function readEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
(async () => {
  const R = root();
  if (!R) { console.log('ERROR: project root not found'); process.exit(2); }
  const url = readEnv(path.join(R, 'backend', '.env')).DATABASE_URL;
  if (!url) { console.log('ERROR: DATABASE_URL not found in backend/.env'); process.exit(2); }
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const latest = await c.query(`SELECT id, year, status FROM inventory_cycles ORDER BY year DESC LIMIT 1`);
    if (latest.rows.length === 0) { console.log('RESULT: no cycles in DB'); return; }
    console.log('LATEST CYCLE: year=' + latest.rows[0].year + ' status=' + latest.rows[0].status + ' id=' + latest.rows[0].id);
    const cid = latest.rows[0].id;
    const view = await c.query(`SELECT id, asset_id, actual_quantity, result, is_verified FROM v_inventory_result WHERE cycle_id = $1 ORDER BY id`, [cid]);
    console.log('VIEW ROWS: ' + view.rows.length);
    for (const r of view.rows) console.log('  view: asset=' + r.asset_id + ' actual_qty=' + r.actual_quantity + ' result=' + r.result + ' verified=' + r.is_verified);
    // exact new export query
    const rows = await c.query(
      `SELECT
         ir.id, ir.asset_id, ir.expected_quantity, ir.actual_quantity,
         ir.actual_status_id, ir.expected_status_id,
         es.name AS expected_status_name,
         ast.name AS actual_status_name,
         vw.result
       FROM inventory_records ir
       JOIN v_inventory_result vw ON vw.id = ir.id
       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id
       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id
       WHERE ir.cycle_id = $1
       ORDER BY ir.id`, [cid]);
    console.log('EXPORT ROWS: ' + rows.rows.length);
    for (const r of rows.rows) console.log('  export: asset=' + r.asset_id + ' expected=' + r.expected_quantity + ' actual=' + r.actual_quantity + ' expStatus=' + r.expected_status_name + ' actStatus=' + r.actual_status_name + ' result=' + r.result);
  } catch (e) {
    console.log('QUERY ERROR: ' + e.message);
  } finally {
    await c.end();
  }
})();

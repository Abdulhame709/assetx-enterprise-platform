// AssetX diagnostic 5: exact backend query WITH tenant context (RLS). Run: node check-export-data5.js
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
  const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  for (const line of raw.split(/\r?\n/)) {
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
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const tenants = await c.query(`SELECT id, name FROM tenants ORDER BY name`);
    console.log('TENANTS: ' + tenants.rows.length);
    if (tenants.rows.length === 0) { console.log('RESULT: no tenants'); return; }
    for (const t of tenants.rows) {
      console.log('--- tenant: ' + t.name + ' ---');
      // mimic backend: set RLS context for this tenant
      await c.query("SELECT set_config('app.tenant_id', $1, false)", [t.id]);
      const latest = await c.query(`SELECT id, year, status FROM inventory_cycles ORDER BY year DESC LIMIT 1`);
      console.log('LATEST CYCLE: ' + (latest.rows[0] ? ('year=' + latest.rows[0].year + ' status=' + latest.rows[0].status) : 'none'));
      if (!latest.rows[0]) { await c.query("SELECT set_config('app.tenant_id', '', false)"); continue; }
      const cid = latest.rows[0].id;
      const rows = await c.query(
        `SELECT
           ir.id, ir.asset_id, ir.expected_quantity, ir.actual_quantity,
           es.name AS expected_status_name, ast.name AS actual_status_name, vw.result
         FROM inventory_records ir
         JOIN v_inventory_result vw ON vw.id = ir.id
         LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id
         LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id
         WHERE ir.cycle_id = $1 ORDER BY ir.id`, [cid]);
      console.log('EXPORT ROWS: ' + rows.rows.length);
      for (const r of rows.rows) console.log('  asset=' + r.asset_id + ' expected=' + r.expected_quantity + ' actual=' + r.actual_quantity + ' expStatus=' + r.expected_status_name + ' actStatus=' + r.actual_status_name + ' result=' + r.result);
      await c.query("SELECT set_config('app.tenant_id', '', false)");
    }
  } catch (e) {
    console.log('QUERY ERROR: ' + e.message);
  } finally {
    await c.end();
  }
})();

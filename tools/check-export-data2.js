// AssetX diagnostic 2: WHERE is the live data really? Run: node check-export-data2.js
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
  const lines = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : [];
  for (const line of lines) {
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
  const env = readEnv(path.join(R, 'backend', '.env'));
  const url = env.DATABASE_URL;
  if (!url) {
    console.log('NO DATABASE_URL in backend/.env');
    console.log('-> backend is probably running on built-in PGlite (local memory). CHECK STARTX.BAT / backend window.');
    process.exit(0);
  }
  let host = '', dbname = '', user = '';
  try { const u = new URL(url); host = u.hostname || ''; dbname = (u.pathname || '').slice(1); user = u.username || ''; } catch (e) { host = '(unparsed url)'; }
  console.log('TARGET: postgres host=' + host + ' db=' + dbname + ' user=' + user);
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const tenants = await c.query(`SELECT id, name FROM tenants ORDER BY name`);
    console.log('TENANTS: ' + tenants.rows.length);
    for (const t of tenants.rows) {
      const cnt = await c.query(`SELECT COUNT(*)::int AS n, COALESCE(MAX(year),0) AS my FROM inventory_cycles WHERE tenant_id = $1`, [t.id]);
      const recs = await c.query(`SELECT COUNT(*)::int AS n FROM inventory_records WHERE cycle_id IN (SELECT id FROM inventory_cycles WHERE tenant_id = $1)`, [t.id]);
      console.log('  tenant=' + t.name + ' cycles=' + cnt.rows[0].n + ' latestYear=' + cnt.rows[0].my + ' records=' + recs.rows[0].n);
    }
    const cycles = await c.query(`SELECT year, status, (SELECT COUNT(*)::int FROM inventory_records r WHERE r.cycle_id = ic.id) AS recs FROM inventory_cycles ic ORDER BY year DESC LIMIT 5`);
    console.log('CYCLES (desc):');
    for (const r of cycles.rows) console.log('  year=' + r.year + ' status=' + r.status + ' records=' + r.recs);
  } catch (e) {
    console.log('QUERY ERROR: ' + e.message);
  } finally {
    await c.end();
  }
})();

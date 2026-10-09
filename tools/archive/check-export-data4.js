// AssetX diagnostic 4: find WHICH database the running backend uses + where the cycles are. Run: node check-export-data4.js
const fs = require('fs');
const path = require('path');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
function safeDb(u) {
  try { return { host: u.hostname, port: u.port || '5432', db: (u.pathname || '').slice(1), user: u.username || '' }; } catch (e) { return null; }
}
function readEnvLines(p) {
  const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const out = {};
  const dbLines = [];
  const keys = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
    keys.push(m[1]);
    if (m[1] === 'DATABASE_URL') dbLines.push(v);
  }
  return { out, keys, dbLines };
}
(async () => {
  const R = root();
  if (!R) { console.log('ERROR: project root not found'); process.exit(2); }
  const envPath = path.join(R, 'backend', '.env');
  const { out: env, keys, dbLines } = readEnvLines(envPath);
  console.log('ENV KEYS: ' + (keys.join(', ') || '(none)'));
  console.log('DATABASE_URL lines found: ' + dbLines.length);
  for (const u of dbLines) {
    const s = safeDb(new URL(u));
    console.log('  -> host=' + s.host + ' port=' + s.port + ' db=' + s.db + ' user=' + s.user);
  }
  if (dbLines.length === 0) { console.log('=> backend uses built-in PGlite (in-memory). DATA IS LOST ON EVERY RESTART. StartX.bat may set DATABASE_URL separately.'); return; }
  const primary = new URL(dbLines[0]);
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const opt = { host: primary.hostname, port: Number(primary.port || 5432), database: 'postgres', user: primary.username, password: primary.password };
  const c = new pg.Client(opt);
  await c.connect();
  try {
    const dbs = await c.query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`);
    console.log('DATABASES ON SERVER: ' + dbs.rows.map((r) => r.datname).join(', '));
    for (const d of dbs.rows) {
      const db = d.datname;
      if (db === 'postgres' || db === 'template0' || db === 'template1') continue;
      const cc = new pg.Client({ host: primary.hostname, port: Number(primary.port || 5432), database: db, user: primary.username, password: primary.password });
      try {
        await cc.connect();
        const t = await cc.query(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name = 'inventory_cycles'`);
        if (t.rows[0].n === 0) { console.log('DB ' + db + ': no inventory_cycles table (not initialized)'); await cc.end(); continue; }
        const cy = await cc.query(`SELECT COUNT(*)::int AS n, COALESCE(MAX(year),0) AS my FROM inventory_cycles`);
        const tn = await cc.query(`SELECT COUNT(*)::int AS n FROM tenants`);
        let tenantInfo = '';
        try { const tt = await cc.query(`SELECT name FROM tenants ORDER BY name`); tenantInfo = tt.rows.map((r) => r.name).join(', '); } catch (e) {}
        console.log('DB ' + db + ': tenants=' + tn.rows[0].n + ' (' + tenantInfo + ') cycles=' + cy.rows[0].n + ' latestYear=' + cy.rows[0].my);
        await cc.end();
      } catch (e) {
        console.log('DB ' + db + ': cannot connect/query (' + e.message.split('\n')[0] + ')');
        try { await cc.end(); } catch (e2) {}
      }
    }
  } catch (e) {
    console.log('ERROR listing databases: ' + e.message.split('\n')[0]);
  } finally {
    await c.end();
  }
  console.log('DONE');
})();

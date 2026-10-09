// AssetX diagnostic 3: find the database the RUNNING backend actually uses. Run: node check-export-data3.js
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
  const lines = raw.split(/\r?\n/);
  const all = [];
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
    all.push(m[1]);
  }
  return { out, keys: all };
}
(async () => {
  const R = root();
  if (!R) { console.log('ERROR: project root not found'); process.exit(2); }
  const envPath = path.join(R, 'backend', '.env');
  const { out: env, keys } = readEnv(envPath);
  console.log('ENV KEYS in backend/.env: ' + keys.join(', '));
  const url = env.DATABASE_URL;
  if (!url) { console.log('NO DATABASE_URL -> backend uses built-in PGlite (memory). DATA WOULD BE LOST ON RESTART.'); process.exit(0); }
  let host = '', dbname = '', user = '', port = '';
  try { const u = new URL(url); host = u.hostname; port = u.port || '5432'; dbname = (u.pathname || '').slice(1); user = u.username || ''; } catch (e) {}
  console.log('ENV URL -> host=' + host + ' port=' + port + ' db=' + dbname + ' user=' + user);
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const dbs = await c.query(`SELECT datname FROM pg_database ORDER BY datname`);
    console.log('DATABASES on this server: ' + dbs.rows.map((r) => r.datname).join(', '));
  } catch (e) { console.log('(cannot list databases: ' + e.message + ')'); }
  try {
    const act = await c.query(`SELECT datname, application_name, state, count(*)::int AS n FROM pg_stat_activity WHERE usename = $1 GROUP BY datname, application_name, state ORDER BY datname`, [user]);
    console.log('LIVE CONNECTIONS (user=' + user + '):');
    for (const r of act.rows) console.log('  db=' + r.datname + ' app=' + (r.application_name || '-') + ' state=' + r.state + ' n=' + r.n);
    if (act.rows.length === 0) console.log('  (no active connections from this user right now)');
  } catch (e) { console.log('(cannot read activity: ' + e.message + ')'); }
  await c.end();
  // If another database shows connections, probe it for cycles
  console.log('DONE');
})();

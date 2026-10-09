// AssetX diagnostic 10: CRLF-aware hash check of the ENTIRE export path + endpoint probes. Run: node check-export-http.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  const env = readEnv(path.join(R, 'backend', '.env'));
  const url = env.DATABASE_URL;
  if (!url) { console.log('ERROR: no DATABASE_URL'); process.exit(2); }
  const accessSecret = env.JWT_ACCESS_SECRET;
  if (!accessSecret) { console.log('ERROR: no JWT_ACCESS_SECRET in backend/.env'); process.exit(2); }
  const jwt = require(path.join(R, 'backend', 'node_modules', 'jsonwebtoken'));
  const pg = require(path.join(R, 'backend', 'node_modules', 'pg'));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  let user = null;
  let tenant = null;
  try {
    const t = await c.query(`SELECT id FROM tenants ORDER BY name LIMIT 1`);
    tenant = t.rows[0] || null;
  } catch (e) { console.log('(tenants read failed: ' + e.message.split('\n')[0] + ')'); }
  if (!tenant) { console.log('ERROR: no tenant found'); process.exit(2); }
  try {
    await c.query("SELECT set_config('app.tenant_id', $1, false)", [tenant.id]);
    const u = await c.query(`SELECT id, username, tenant_id FROM users WHERE is_active = true ORDER BY created_at LIMIT 1`);
    user = u.rows[0] || null;
  } catch (e) { console.log('(users read failed: ' + e.message.split('\n')[0] + ')'); }
  if (user) {
    try {
      const roles = await c.query(
        `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.name`, [user.id]);
      const perms = await c.query(
        `SELECT p.key FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = $1 ORDER BY p.key`, [user.id]);
      user.roles = roles.rows.map((r) => r.name);
      user.perms = perms.rows.map((p) => p.key);
    } catch (e) { user.roles = []; user.perms = []; }
  }
  let permissionVersion = 1;
  try {
    const pv = await c.query(
      `SELECT setting_value FROM settings WHERE tenant_id = $1 AND setting_key = 'permission_version' LIMIT 1`,
      [user ? user.tenant_id : tenant.id],
    );
    const raw = pv.rows[0]?.setting_value ?? 'MISSING';
    console.log('settings.permission_version = ' + raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) permissionVersion = n; else permissionVersion = 0;
  } catch (e) { console.log('(permission_version read failed: ' + e.message.split('\n')[0] + ')'); }
  await c.end();
  if (!user) { console.log('ERROR: no user found to sign token'); process.exit(2); }
  console.log('USER: ' + user.username + ' tenant=' + user.tenant_id + ' roles=[' + user.roles.join(',') + '] perms=' + user.perms.length + ' permission_version=' + permissionVersion);
  const payload = {
    sub: user.id, username: user.username, tenant_id: user.tenant_id,
    role: user.roles[0] || 'Employee',
    roles: user.roles.length ? user.roles : ['Employee'],
    permissions: user.perms.length ? user.perms : ['export.inventory', 'export.assets'],
    permission_version: permissionVersion, session_id: 'diag',
  };
  const OFFICIAL = {
    'backend/src/application/inventory-result.service.ts': 'e2ce6574ab1fa3dfaed992df775488026607e785a9183d529f79c6a30bf286f9',
    'backend/src/application/export/export-pipeline.service.ts': 'ee16ea4105c880d375b9f3c3a56a0a188435cd8cfcd0925b6f19d13bce450474',
    'backend/src/application/export/export-metrics.service.ts': '4e3f7e394c9a38da60420b04aaad40f253b68dee1eddcff03b0ce0a697393d5b',
    'backend/src/application/export/adapters/export-data.adapter.ts': '0bc68ab47b9f9fe39b55aa59f285935a4b3c11de2c0abb60922d0e0a4f768a91',
    'backend/src/application/export/export-profile.registry.ts': '0b2ed3ec27e52129add66d03f866fa91ab1176a68c1f427f5d92393f0f87eda3',
    'backend/src/application/export.service.ts': '35713d971e3175900554b21c7ade0fc825b58bc485f94d924ee754a10bbbfd77',
    'backend/src/api/export/export.controller.ts': '29e5592887a4a0d2a61d60c33011e4328c551bcd8754b882eb36380bbd9577a3',
    'backend/src/infrastructure/export/csv.generator.ts': 'a34d9be371283d4feb6b3ee23c2d7bda9408920d8e8cfaac88b100061e83d828',
    'backend/src/infrastructure/export/column-plan.ts': '92a271813f6ae38a300dbc1c9b1ea9e1e1278f974b534c2f8b024ab16c8c4623',
    'backend/src/infrastructure/export/file-generator.factory.ts': 'ea5a2797b22360876c6ebb3f2f1c33799083df384b8233467c661931b9a623c5',
    'backend/src/infrastructure/export/strategies/csv-export.strategy.ts': '7aa919de192a2f6a31487c75f6e0e9ade0157528e91ae22cd78d8fdfbdcec579',
    'backend/src/infrastructure/export/strategies/export-strategy.factory.ts': 'f43b911f3b9975530a4688741f5c5a0ace0cb7f1d477fbbff08880f6a2291c04',
    'backend/src/infrastructure/repositories/result.repository.ts': '9d281ad38b9f2e8ee916d4b2237ccedd3c1e8903da1124ed104ba46b9fa410b6',
    'backend/src/application/export/providers/inventory-export.provider.ts': '1d8dd36f990a3c6abd8baeefb39007433afb033e902e90e56e879ba12d47d1ae',
  };
  console.log('--- FILE HASH CHECK (normalized CRLF, vs official) ---');
  for (const [rel, official] of Object.entries(OFFICIAL)) {
    const p = path.join(R, rel);
    if (!fs.existsSync(p)) { console.log(rel + ': MISSING'); continue; }
    const normalized = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const h = crypto.createHash('sha256').update(normalized).digest('hex');
    console.log(rel + ': ' + (h === official ? 'MATCH' : 'DIFF (' + h.slice(0, 16) + '...)'));
  }
  const DEFAULT_SECRET = 'assetx-local-access-secret-dev-only';
  const secrets = [accessSecret, DEFAULT_SECRET].filter((v, i, a) => a.indexOf(v) === i);
  let goodToken = null;
  for (const secret of secrets) {
    const token = jwt.sign(payload, secret, { expiresIn: '5m' });
    const probe = await fetch('http://127.0.0.1:3001/exports/inventory?format=csv', {
      headers: { Authorization: 'Bearer ' + token },
    });
    console.log('--- secret #' + (secrets.indexOf(secret) + 1) + ' probe: HTTP ' + probe.status + ' ---');
    if (probe.status === 200) { goodToken = token; console.log('=> secret #' + (secrets.indexOf(secret) + 1) + ' is ACCEPTED'); break; }
  }
  if (!goodToken) { console.log('ERROR: no accepted secret'); process.exit(2); }
  const variants = [
    { name: 'A: format=csv only', qs: new URLSearchParams({ format: 'csv' }) },
    { name: 'B: csv + 10 inventory columns (like frontend)', qs: new URLSearchParams({ format: 'csv', limit: '10000', columns: JSON.stringify([
      { key: 'record_id', label: 'Record ID', order: 1 },
      { key: 'cycle_id', label: 'Cycle ID', order: 2 },
      { key: 'asset_id', label: 'Asset ID', order: 3 },
      { key: 'expected_quantity', label: 'Expected Quantity', order: 4 },
      { key: 'actual_quantity', label: 'Actual Quantity', order: 5 },
      { key: 'expected_status_name', label: 'Expected Status', order: 6 },
      { key: 'actual_status_name', label: 'Actual Status', order: 7 },
      { key: 'result', label: 'Result', order: 8 },
      { key: 'inventory_date', label: 'Inventory Date', order: 9 },
      { key: 'notes', label: 'Notes', order: 10 },
    ]) }) },
    { name: 'C: csv + minimal columns', qs: new URLSearchParams({ format: 'csv', limit: '1000', columns: JSON.stringify([
      { key: 'record_id', label: 'Record ID', order: 1 },
      { key: 'asset_id', label: 'Asset ID', order: 2 },
      { key: 'expected_status_name', label: 'Expected Status', order: 3 },
      { key: 'actual_status_name', label: 'Actual Status', order: 4 },
      { key: 'result', label: 'Result', order: 5 },
    ]) }) },
    { name: 'D: csv + profile=inventory', qs: new URLSearchParams({ format: 'csv', profile: 'inventory' }) },
  ];
  for (const v of variants) {
    console.log('=== VARIANT ' + v.name + ' ===');
    try {
      const res = await fetch('http://127.0.0.1:3001/exports/inventory?' + v.qs.toString(), {
        headers: { Authorization: 'Bearer ' + goodToken },
      });
      console.log('HTTP: ' + res.status + ' ' + res.statusText);
      console.log('CONTENT-TYPE: ' + (res.headers.get('content-type') || '-'));
      console.log('CONTENT-DISPOSITION: ' + (res.headers.get('content-disposition') || '-'));
      const body = await res.text();
      console.log('BODY LENGTH: ' + body.length + ' chars');
      console.log('BODY: [' + body + ']');
    } catch (e) {
      console.log('FETCH ERROR: ' + e.message);
    }
  }
})();

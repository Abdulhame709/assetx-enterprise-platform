// AssetX fix: asset type was missing from the assets list (only the record page showed it).
// Cause: the list summary projection dropped category_id, so the UI rendered a dash for every row.
// Run: node tools/fix-asset-type.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}

function read(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), eol: raw.includes('\r\n') ? '\r\n' : '\n', bom: raw.startsWith('\uFEFF') };
}

function write(p, text, eol, bom) {
  const out = text.replace(/\n/g, eol);
  fs.writeFileSync(p, (bom ? '\uFEFF' : '') + out, 'utf8');
}

function patch(r, rel, oldText, newText, label, optional, alreadyMarker) {
  const p = path.join(r, rel);
  if (!fs.existsSync(p)) {
    console.log((optional ? 'SKIP ' : 'MISS ') + label + ' (file not found)');
    return optional ? 'skip' : 'miss';
  }
  const file = read(p);
  if (file.text.includes(newText) || (alreadyMarker && file.text.includes(alreadyMarker))) { console.log('ALREADY ' + label); return 'ok'; }
  if (!file.text.includes(oldText)) {
    console.log((optional ? 'SKIP ' : 'MISS ') + label + ' (anchor not found)');
    return optional ? 'skip' : 'miss';
  }
  const backup = p + '.bak-assettype';
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, file.text.replace(/\n/g, file.eol), 'utf8');
  write(p, file.text.replace(oldText, newText), file.eol, file.bom);
  console.log('OK ' + label);
  return 'ok';
}

const R = root();
if (!R) { console.log('ERROR: project root not found (web/ + backend/ must be nearby)'); process.exit(2); }
console.log('ROOT: ' + R);
let ok = 0;

// 1/3 - backend entity: the summary contract must carry the type id.
ok += patch(R, 'backend/src/core/entities/asset.entity.ts',
  `export interface AssetSummary {
  id: string;
  name: string;
  full_asset_code: string;
  base_asset_code: string;
  quantity: number;
  status_id: string | null;`,
  `export interface AssetSummary {
  id: string;
  name: string;
  full_asset_code: string;
  base_asset_code: string;
  quantity: number;
  // UX fix: the list/preview must show the asset type. The column existed in the
  // table but was dropped by this projection, so every list row rendered a dash.
  category_id: string | null;
  status_id: string | null;`,
  '1/3 backend entity (AssetSummary.category_id)', false, 'category_id: string | null;\n  status_id: string | null;') === 'ok' ? 1 : 0;

// 2/3 + 3/3 - both summary projections (repository + service) must emit the column.
const projectionOld = `      base_asset_code: a.base_asset_code,
      quantity: a.quantity,
      status_id: a.status_id,`;
const projectionNew = `      base_asset_code: a.base_asset_code,
      quantity: a.quantity,
      category_id: a.category_id,
      status_id: a.status_id,`;
ok += patch(R, 'backend/src/infrastructure/repositories/asset.repository.ts', projectionOld, projectionNew, '2/3 repository search/read projection', false, 'category_id: a.category_id,') === 'ok' ? 1 : 0;
ok += patch(R, 'backend/src/application/asset.service.ts', projectionOld, projectionNew, '3/3 service projection', false, 'category_id: a.category_id,') === 'ok' ? 1 : 0;

// 4/3 (best effort) - keep the frontend type in sync; the mapper already resolves the name.
patch(R, 'web/src/features/assets/types.ts',
  `  base_asset_code: string;
  quantity: number;
  status_id: string | null;`,
  `  base_asset_code: string;
  quantity: number;
  /** Present on list payloads too (the API summary projection now carries it). */
  category_id?: string | null;
  status_id: string | null;`,
  '4/3 web types (optional)', true, 'category_id?: string | null;');

// ---- optional rebuild: the backend may run from the compiled "dist" folder ----
function rebuildIfCompiled(r) {
  const backendDir = path.join(r, 'backend');
  const distEntry = path.join(backendDir, 'dist', 'main.js');
  if (!fs.existsSync(distEntry)) {
    console.log('STEP rebuild: not needed (the backend runs from source).');
    return true;
  }
  console.log('STEP rebuild: the backend runs from dist - rebuilding so the fix takes effect ...');
  const tsc = path.join(backendDir, 'node_modules', 'typescript', 'bin', 'tsc');
  let result;
  if (fs.existsSync(tsc)) {
    result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: backendDir, encoding: 'utf8' });
  } else {
    result = spawnSync('npm', ['run', 'build'], { cwd: backendDir, encoding: 'utf8', shell: true });
  }
  const output = String(result.stdout || '') + String(result.stderr || '');
  if (result.status !== 0) {
    console.log('STEP rebuild: FAILED');
    console.log(output.split(/\r?\n/).filter(Boolean).slice(-12).join('\n'));
    return false;
  }
  console.log('STEP rebuild: OK (dist updated).');
  return true;
}

// ---- verification ----
function has(rel, needle) {
  const p = path.join(R, rel);
  if (!fs.existsSync(p)) return false;
  return read(p).text.includes(needle);
}
const checks = [
  ['entity', has('backend/src/core/entities/asset.entity.ts', '  category_id: string | null;\n  status_id: string | null;')],
  ['repository', has('backend/src/infrastructure/repositories/asset.repository.ts', '      category_id: a.category_id,')],
  ['service', has('backend/src/application/asset.service.ts', '      category_id: a.category_id,')],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? '  [OK] ' : '  [FAIL] ') + name);
  if (!pass) failed += 1;
}
console.log('---');
if (failed !== 0) {
  console.log('VERIFY: FAILED');
  process.exit(1);
}
const rebuilt = rebuildIfCompiled(R);
console.log('---');
console.log(rebuilt ? 'VERIFY: ALL OK (' + ok + '/4 patched)' : 'VERIFY: PATCHED BUT REBUILD FAILED - send me the lines above.');
process.exit(rebuilt ? 0 : 3);

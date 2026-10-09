// AssetX fix 3: rebuild backend dist so the export fix takes effect. Run: node patch-paste3.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
const R = root();
if (!R) { console.log('ERROR: project root not found (web/ + backend/ must be nearby)'); process.exit(2); }
console.log('ROOT: ' + R);
const backend = path.join(R, 'backend');
const srcDir = path.join(backend, 'src');
const distDir = path.join(backend, 'dist');
if (!fs.existsSync(distDir)) { console.log('NOTE: no dist folder -> backend runs from src (ts-node). Nothing to rebuild.'); process.exit(0); }
// 1) verify the two source fixes are present (idempotent re-apply)
function rd(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function patch(r, rel, oldS, newS, lbl) {
  const p = path.join(r, rel);
  if (!fs.existsSync(p)) { console.log('MISS ' + lbl + ' (missing file)'); return false; }
  let t = rd(p);
  if (t.includes(newS)) { console.log('ALREADY ' + lbl); return true; }
  if (!t.includes(oldS)) { console.log('MISS ' + lbl + ' (anchor not found)'); return false; }
  const bak = p + '.bak-syncfix';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, t, 'utf8');
  fs.writeFileSync(p, t.split(oldS).join(newS), 'utf8');
  console.log('OK ' + lbl);
  return true;
}
if (!fs.existsSync(path.join(srcDir, 'application', 'inventory-result.service.ts'))) {
  console.log('ERROR: source folder not found: ' + srcDir);
  process.exit(2);
}
const hasServiceFix = rd(path.join(srcDir, 'application', 'inventory-result.service.ts')).includes('getResultsForLatest');
const hasProviderFix = rd(path.join(srcDir, 'application', 'export', 'providers', 'inventory-export.provider.ts')).includes('getResultsForLatest');
if (!hasServiceFix || !hasProviderFix) { console.log('ERROR: source fixes missing - run patch-paste2.js first.'); process.exit(2); }
console.log('SRC-FIX-OK');
// 2) rebuild dist
console.log('BUILDING backend (npm run build)...');
const build = spawnSync('npm', ['run', 'build'], { cwd: backend, shell: true, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('BUILD-FAILED');
  console.log((build.stdout || '') + '\n' + (build.stderr || ''));
  process.exit(1);
}
// 3) verify dist now contains the fix
const svcPath = path.join(distDir, 'application', 'inventory-result.service.js');
const provPath = path.join(distDir, 'application', 'export', 'providers', 'inventory-export.provider.js');
if (fs.existsSync(svcPath) && fs.existsSync(provPath)) {
  const svcOk = rd(svcPath).includes('getResultsForLatest');
  const provOk = rd(provPath).includes('getResultsForLatest');
  console.log(svcOk && provOk ? 'DIST-FIX-OK' : 'DIST-FIX-MISSING');
  if (!svcOk || !provOk) process.exit(1);
} else {
  console.log('DIST-NOT-FOUND (check backend/dist path)');
  process.exit(1);
}
console.log('SUCCESS: backend rebuilt with export fix. Restart the 3 windows (StartX.bat) and re-download the report.');

// AssetX fix: correct the debug-2 log (compile error) + add proper byte counter. Run: node fix-export-debug2.js
const fs = require('fs');
const path = require('path');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
function norm(p) {
  return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
const R = root();
if (!R) { console.log('ERROR: project root not found'); process.exit(2); }
const p = path.join(R, 'backend/src/application/export/export-pipeline.service.ts');
let t = norm(p);
let changed = 0;

// 1) REMOVE the bad log that was inserted inside run() (outside 'count' scope)
const bad = "    pass.on('end', () => {\n      console.error('[DBG2] stream END total=' + count + ' bytes');\n";
const good = "    pass.on('end', () => {\n";
if (t.includes(bad)) {
  t = t.replace(bad, good);
  changed++;
  console.log('OK   REMOVED-BAD-LOG');
} else {
  console.log('OK   BAD-LOG-NOT-FOUND');
}

// 2) ADD the byte counter end-log INSIDE measured() (before raw.pipe)
const anchor = '    raw.pipe(pass);\n';
const insert = "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n    raw.pipe(pass);\n";
if (t.includes("pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));")) {
  console.log('OK   END-LOG-ALREADY');
} else if (t.includes(anchor)) {
  t = t.replace(anchor, insert);
  changed++;
  console.log('OK   END-LOG-ADDED');
} else {
  console.log('MISS END-LOG-ANCHOR');
}
fs.writeFileSync(p, t, 'utf8');
console.log('DONE. changed=' + changed + '. Restart the backend (StartX.bat), run check-export-http.js, then send [DBG2] lines.');

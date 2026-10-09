// AssetX cleanup: remove all temporary [DBG]/[DBG2] log lines (fix stays). Run: node cleanup-export-debug.js
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
const FILES = {
  'backend/src/infrastructure/repositories/result.repository.ts': [
    "    console.error('[DBG] getResults rows=' + (rows ? rows.length : -1));\n",
  ],
  'backend/src/infrastructure/export/csv.generator.ts': [
    "    console.error('[DBG] csvgen data=' + (Array.isArray(data) ? data.length : 'NONARRAY') + ' headers=' + includeHeaders);\n",
  ],
  'backend/src/application/export/export-pipeline.service.ts': [
    "    console.error('[DBG] pipeline rows=' + outputRows + ' fmt=' + ctx.strategy.format);\n",
    "        console.error('[DBG2] stream chunk=' + chunk.length + ' bytes');\n",
    "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n",
  ],
  'backend/src/application/export.service.ts': [
    "      console.error('[DBG2] svc streamName=' + (res.stream && res.stream.constructor && res.stream.constructor.name) + ' strategy=' + (res.strategy ? res.strategy.constructor.name : '-'));\n",
  ],
  'backend/src/main.ts': [
    "  console.error('[DBG] DATABASE_URL=' + (process.env.DATABASE_URL ? String(process.env.DATABASE_URL).replace(/(:\\/\\/[^:]+:)[^@]+@/, '$1***@') : 'NONE'));\n",
  ],
};
let removed = 0;
for (const [rel, lines] of Object.entries(FILES)) {
  const p = path.join(R, rel);
  if (!fs.existsSync(p)) { console.log(rel + ': MISSING'); continue; }
  const t0 = norm(p);
  let t = t0;
  for (const line of lines) {
    if (t.includes(line)) {
      t = t.replace(line, '');
      removed++;
    }
  }
  fs.writeFileSync(p, t, 'utf8');
  console.log(rel + ': ' + (t.includes('[DBG]') || t.includes('[DBG2]') ? 'STILL HAS DBG' : 'CLEAN'));
}
console.log('DONE. removed=' + removed + '. Restart the backend once more (StartX.bat) - logs are clean now.');

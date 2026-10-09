// AssetX debug: insert 3 diagnostic log lines into the export path (temporary). Run: node add-export-debug.js
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

// 1) result.repository.ts - log rows returned by getResults
let p1 = path.join(R, 'backend/src/infrastructure/repositories/result.repository.ts');
let t1 = norm(p1);
const a1 = '    return rows;\n  }\n}\n';
const r1 = '    console.error(\'[DBG] getResults rows=\' + (rows ? rows.length : -1));\n    return rows;\n  }\n}\n';
if (t1.includes('[DBG] getResults')) {
  console.log('OK   RESULT-DBG-ALREADY');
} else if (t1.includes(a1)) {
  t1 = t1.replace(a1, r1);
  fs.writeFileSync(p1, t1, 'utf8');
  console.log('OK   RESULT-DBG-ADDED');
} else {
  console.log('MISS RESULT-DBG-ANCHOR');
}

// 2) csv.generator.ts - log data/headers at generate()
let p2 = path.join(R, 'backend/src/infrastructure/export/csv.generator.ts');
let t2 = norm(p2);
const a2 = '    const includeHeaders = options?.includeHeaders ?? true;\n';
const r2 = a2 + '    console.error(\'[DBG] csvgen data=\' + (Array.isArray(data) ? data.length : \'NONARRAY\') + \' headers=\' + includeHeaders);\n';
if (t2.includes('[DBG] csvgen')) {
  console.log('OK   CSVGEN-DBG-ALREADY');
} else if (t2.includes(a2)) {
  t2 = t2.replace(a2, r2);
  fs.writeFileSync(p2, t2, 'utf8');
  console.log('OK   CSVGEN-DBG-ADDED');
} else {
  console.log('MISS CSVGEN-DBG-ANCHOR');
}

// 3) export-pipeline.service.ts - log transformed rows + format
let p3 = path.join(R, 'backend/src/application/export/export-pipeline.service.ts');
let t3 = norm(p3);
const a3 = '    const outputRows = transformed.length;\n';
const r3 = a3 + '    console.error(\'[DBG] pipeline rows=\' + outputRows + \' fmt=\' + ctx.strategy.format);\n';
if (t3.includes('[DBG] pipeline')) {
  console.log('OK   PIPELINE-DBG-ALREADY');
} else if (t3.includes(a3)) {
  t3 = t3.replace(a3, r3);
  fs.writeFileSync(p3, t3, 'utf8');
  console.log('OK   PIPELINE-DBG-ADDED');
} else {
  console.log('MISS PIPELINE-DBG-ANCHOR');
}

// 4) main.ts - print (masked) DATABASE_URL the server actually uses
let p4 = path.join(R, 'backend/src/main.ts');
let t4 = norm(p4);
const a4 = '  loadLocalEnvironment();\n';
const r4 = a4 + '  console.error(\'[DBG] DATABASE_URL=\' + (process.env.DATABASE_URL ? String(process.env.DATABASE_URL).replace(/(:\\/\\/[^:]+:)[^@]+@/, \'$1***@\') : \'NONE\'));\n';
if (t4.includes('[DBG] DATABASE_URL')) {
  console.log('OK   MAIN-DBG-ALREADY');
} else if (t4.includes(a4)) {
  t4 = t4.replace(a4, r4);
  fs.writeFileSync(p4, t4, 'utf8');
  console.log('OK   MAIN-DBG-ADDED');
} else {
  console.log('MISS MAIN-DBG-ANCHOR');
}
console.log('DONE. Restart the backend, run check-export-http.js, then send the BACKEND window log lines starting with [DBG].');

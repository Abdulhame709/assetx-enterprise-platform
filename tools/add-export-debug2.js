// AssetX debug 2: count bytes flowing out of the export pipeline. Run: node add-export-debug2.js
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

// 1) export-pipeline.service.ts - count bytes on the output PassThrough
let p1 = path.join(R, 'backend/src/application/export/export-pipeline.service.ts');
let t1 = norm(p1);
const a1 = "    pass.on('data', (c: Buffer) => { count += c.length; });\n";
const r1 = "    pass.on('data', (c: Buffer) => { count += c.length; console.error('[DBG2] stream chunk=' + c.length + ' bytes'); });\n";
if (t1.includes('[DBG2] stream chunk')) {
  console.log('OK   STREAM-ALREADY');
} else if (t1.includes(a1)) {
  t1 = t1.replace(a1, r1);
  fs.writeFileSync(p1, t1, 'utf8');
  console.log('OK   STREAM-DBG-ADDED');
} else {
  console.log('MISS STREAM-ANCHOR');
}
const a1b = "    pass.on('end', () => {\n";
const r1b = "    pass.on('end', () => {\n      console.error('[DBG2] stream END total=' + count + ' bytes');\n";
if (t1.includes('[DBG2] stream END')) {
  console.log('OK   STREAMEND-ALREADY');
} else if (t1.includes(a1b)) {
  t1 = t1.replace(a1b, r1b);
  fs.writeFileSync(p1, t1, 'utf8');
  console.log('OK   STREAMEND-DBG-ADDED');
} else {
  console.log('MISS STREAMEND-ANCHOR');
}

// 2) export.service.ts - log stream constructor after generate
let p2 = path.join(R, 'backend/src/application/export.service.ts');
let t2 = norm(p2);
const a2 = '      return {\n        stream: res.stream,\n';
const r2 = '      console.error(\'[DBG2] svc streamName=\' + (res.stream && res.stream.constructor && res.stream.constructor.name) + \' strategy=\' + (res.strategy ? res.strategy.constructor.name : \'-\'));\n      return {\n        stream: res.stream,\n';
if (t2.includes('[DBG2] svc streamName')) {
  console.log('OK   SVC-ALREADY');
} else if (t2.includes(a2)) {
  t2 = t2.replace(a2, r2);
  fs.writeFileSync(p2, t2, 'utf8');
  console.log('OK   SVC-DBG-ADDED');
} else {
  console.log('MISS SVC-ANCHOR');
}
console.log('DONE. Restart the backend, run the checks, send the BACKEND window [DBG2] lines.');

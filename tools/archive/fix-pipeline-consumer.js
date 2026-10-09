// AssetX ROOT FIX: byte counter must PASS data through, not consume it (caused empty downloads). Run: node fix-pipeline-consumer.js
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

// 1) import Transform
const oldImport = "import { PassThrough } from 'stream';";
const newImport = "import { PassThrough, Transform } from 'stream';";
if (t.includes(newImport)) {
  console.log('OK   IMPORT-ALREADY');
} else if (t.includes(oldImport)) {
  t = t.replace(oldImport, newImport);
  changed++;
  console.log('OK   IMPORT-FIXED');
} else {
  console.log('MISS IMPORT-ANCHOR');
}

// 2) replace the counting PassThrough with a passing Transform
const bad2 = "    const pass = new PassThrough();\n" +
  "    pass.on('data', (c: Buffer) => { count += c.length; console.error('[DBG2] stream chunk=' + c.length + ' bytes'); });\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n" +
  "    raw.pipe(pass);\n";
const bad1 = "    const pass = new PassThrough();\n" +
  "    pass.on('data', (c: Buffer) => { count += c.length; });\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    raw.pipe(pass);\n";
const fixed = "    const pass = new Transform({\n" +
  "      transform(chunk: Buffer, _enc: BufferEncoding, callback: (err?: Error | null, data?: Buffer) => void) {\n" +
  "        count += chunk.length;\n" +
  "        console.error('[DBG2] stream chunk=' + chunk.length + ' bytes');\n" +
  "        callback(null, chunk);\n" +
  "      },\n" +
  "    });\n" +
  "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    raw.pipe(pass);\n";
if (t.includes(fixed)) {
  console.log('OK   TRANSFORM-ALREADY');
} else if (t.includes(bad2)) {
  t = t.replace(bad2, fixed);
  changed++;
  console.log('OK   TRANSFORM-FIXED');
} else if (t.includes(bad1)) {
  t = t.replace(bad1, fixed);
  changed++;
  console.log('OK   TRANSFORM-FIXED (no-debug variant)');
} else {
  console.log('MISS TRANSFORM-ANCHOR');
}
fs.writeFileSync(p, t, 'utf8');
console.log('DONE. changed=' + changed + '. Restart the backend (StartX.bat), run check-export-http.js, send the check output.');

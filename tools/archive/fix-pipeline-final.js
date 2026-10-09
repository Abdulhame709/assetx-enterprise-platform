// AssetX FINAL FIX: move progress emission to the writable side so NO listener consumes the stream (empty-download root cause). Run: node fix-pipeline-final.js
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

// 1) run(): remove the consuming pass.on('data') progress listener; move it into measured()
const oldRun = "    const { pass, bytes } = this.measured(raw);\n" +
  "    let lastEmitted = 0;\n\n" +
  "    pass.on('data', (chunk: Buffer) => {\n" +
  "      if (bytes() - lastEmitted >= PROGRESS_INTERVAL_BYTES) {\n" +
  "        lastEmitted = bytes();\n" +
  "        this.publishProgress(ctx, { phase: 'stream', rows: outputRows, bytes: bytes(), percent: null });\n" +
  "      }\n" +
  "    });\n";
const newRun = "    let lastEmitted = 0;\n" +
  "    const { pass, bytes } = this.measured(raw, (total) => {\n" +
  "      if (total - lastEmitted >= PROGRESS_INTERVAL_BYTES) {\n" +
  "        lastEmitted = total;\n" +
  "        this.publishProgress(ctx, { phase: 'stream', rows: outputRows, bytes: total, percent: null });\n" +
  "      }\n" +
  "    });\n";
if (t.includes(newRun)) {
  console.log('OK   RUN-ALREADY');
} else if (t.includes(oldRun)) {
  t = t.replace(oldRun, newRun);
  changed++;
  console.log('OK   RUN-FIXED');
} else {
  console.log('MISS RUN-ANCHOR');
}

// 2) measured(): accept onProgress and emit from the transform callback (writable side)
const oldMeasured = "  private measured(raw: NodeJS.ReadableStream): { pass: PassThrough; bytes: () => number } {\n" +
  "    let count = 0;\n" +
  "    const pass = new Transform({\n" +
  "      transform(chunk: Buffer, _enc: BufferEncoding, callback: (err?: Error | null, data?: Buffer) => void) {\n" +
  "        count += chunk.length;\n" +
  "        console.error('[DBG2] stream chunk=' + chunk.length + ' bytes');\n" +
  "        callback(null, chunk);\n" +
  "      },\n" +
  "    });\n" +
  "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    raw.pipe(pass);\n" +
  "    return { pass, bytes: () => count };\n" +
  "  }\n";
const oldMeasuredNoLog = "  private measured(raw: NodeJS.ReadableStream): { pass: PassThrough; bytes: () => number } {\n" +
  "    let count = 0;\n" +
  "    const pass = new Transform({\n" +
  "      transform(chunk: Buffer, _enc: BufferEncoding, callback: (err?: Error | null, data?: Buffer) => void) {\n" +
  "        count += chunk.length;\n" +
  "        callback(null, chunk);\n" +
  "      },\n" +
  "    });\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    raw.pipe(pass);\n" +
  "    return { pass, bytes: () => count };\n" +
  "  }\n";
const newMeasured = "  /** Counting happens on the WRITABLE side; nothing consumes the readable side. */\n" +
  "  private measured(raw: NodeJS.ReadableStream, onProgress?: (total: number) => void): { pass: PassThrough; bytes: () => number } {\n" +
  "    let count = 0;\n" +
  "    const pass = new Transform({\n" +
  "      transform(chunk: Buffer, _enc: BufferEncoding, callback: (err?: Error | null, data?: Buffer) => void) {\n" +
  "        count += chunk.length;\n" +
  "        if (onProgress) onProgress(count);\n" +
  "        console.error('[DBG2] stream chunk=' + chunk.length + ' bytes');\n" +
  "        callback(null, chunk);\n" +
  "      },\n" +
  "    });\n" +
  "    pass.on('end', () => console.error('[DBG2] stream END total=' + count + ' bytes'));\n" +
  "    raw.on('error', (e) => pass.destroy(e));\n" +
  "    raw.pipe(pass);\n" +
  "    return { pass, bytes: () => count };\n" +
  "  }\n";
if (t.includes(newMeasured)) {
  console.log('OK   MEASURED-ALREADY');
} else if (t.includes(oldMeasured)) {
  t = t.replace(oldMeasured, newMeasured);
  changed++;
  console.log('OK   MEASURED-FIXED');
} else if (t.includes(oldMeasuredNoLog)) {
  t = t.replace(oldMeasuredNoLog, newMeasured);
  changed++;
  console.log('OK   MEASURED-FIXED (no-debug variant)');
} else {
  console.log('MISS MEASURED-ANCHOR');
}
fs.writeFileSync(p, t, 'utf8');
console.log('DONE. changed=' + changed + '. Restart the backend (StartX.bat), run check-export-http.js - CSV rows should now reach you.');

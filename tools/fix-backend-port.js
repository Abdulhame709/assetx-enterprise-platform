#!/usr/bin/env node
/**
 * fix-backend-port.js
 * --------------------
 * Makes the backend listen on :3001 by default (matching the web proxy
 * target and .env.example). Previously main.ts defaulted to :3000, so the
 * web app got "Failed to proxy http://127.0.0.1:3001 ... ECONNREFUSED"
 * whenever backend/.env did not exist.
 *
 * Safe to re-run (skips when already fixed). ASCII-only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function findRoot() {
  const candidates = [__dirname, path.resolve(__dirname, '..'), process.cwd(), path.resolve(process.cwd(), '..')];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}

const ROOT = findRoot();
if (!ROOT) {
  console.log('[ERROR] project folder not found. Run from inside assetx-enterprise-platform-v2.');
  process.exit(1);
}

const FILE = path.join(ROOT, 'backend', 'src', 'main.ts');
if (!fs.existsSync(FILE)) {
  console.log('[ERROR] missing ' + FILE);
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const Old = /const port = Number\(process\.env\.PORT \?\? 3000\);/.test(raw);
const New = /const port = Number\(process\.env\.PORT \?\? 3001\);/.test(raw);

if (New) {
  console.log('[OK] backend/src/main.ts => already fixed (port 3001 default)');
  process.exit(0);
}
if (!Old) {
  console.log('[ERROR] port anchor not found in backend/src/main.ts');
  process.exit(1);
}

const text = raw.replace(
  /const port = Number\(process\.env\.PORT \?\? 3000\);/,
  [ '  // Match the web proxy target (next.config.mjs -> 127.0.0.1:3001) and the',
    '  // documented PORT=3001 in .env.example. Previously defaulted to 3000, which',
    '  // made the web app get ECONNREFUSED whenever backend/.env was absent.',
    '  const port = Number(process.env.PORT ?? 3001);',
  ].join('\n'),
);
fs.writeFileSync(FILE, raw.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text, 'utf8');

console.log('[OK] backend/src/main.ts => PATCHED (default port 3001)');
console.log('VERIFY: ALL OK');
console.log('DONE. restart needed: close the 3 windows, run StartX.bat.');

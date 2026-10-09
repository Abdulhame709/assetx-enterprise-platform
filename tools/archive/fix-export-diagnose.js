#!/usr/bin/env node
/**
 * fix-export-diagnose.js
 * ----------------------
 * Makes export failures show the REAL reason on screen instead of
 * "500 (Internal Server Error)".
 *
 * Two small changes:
 *  1) backend/src/api/export/export.controller.ts — on export error, return
 *     the actual message (e.g. a SQL column error) in the HTTP response.
 *  2) web/src/features/reports/api.ts — read that message and show it in the
 *     error toast so you can copy it back.
 *
 * Safe to run more than once (skips already-fixed parts).
 * This file is ASCII-only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function findRoot() {
  const candidates = [
    __dirname,
    path.resolve(__dirname, '..'),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ];
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

const CTRL = path.join(ROOT, 'backend', 'src', 'api', 'export', 'export.controller.ts');
const API = path.join(ROOT, 'web', 'src', 'features', 'reports', 'api.ts');

function readFile(f) {
  const raw = fs.readFileSync(f, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: /\r\n/.test(raw) };
}
function writeFile(f, text, crlf) {
  fs.writeFileSync(f, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}

// ---- 1) export.controller.ts -------------------------------------------------
function patchController() {
  if (!fs.existsSync(CTRL)) {
    console.log('[ERROR] missing ' + CTRL);
    return false;
  }
  const { text, crlf } = readFile(CTRL);
  if (text.includes('EXPORT_FAILED:')) {
    console.log('[OK] export.controller.ts => already fixed');
    return true;
  }
  const anchor = '    const result = await this.exports.generate({';
  const newBlock = [
    '    let result;',
    '    try {',
    '      result = await this.exports.generate({',
  ].join('\n');
  // Replace "const result = await this.exports.generate({" with try-block opener
  let c = text.replace(anchor, newBlock, 1);
  const endAnchor = "    result.stream.pipe(res);\n  }";
  const closeBlock = [
    '    } catch (err) {',
    '      // Surface the real reason (e.g. DB/SQL errors) so a failed export is',
    '      // diagnosable instead of a generic 500.',
    '      const reason = (err as Error)?.message ?? \'unknown export error\';',
    "      // eslint-disable-next-line no-console\n      console.error(`[ExportController] ${resource}/${fmt} export failed:`, err);\n      throw new BadRequestException(`EXPORT_FAILED: ${reason}`);\n    }",
  ].join('\n');
  if (!c.includes(endAnchor)) {
    console.log('[ERROR] export.controller.ts: stream() end block not found');
    return false;
  }
  // The ");" line after the generate() options object is the call close; put
  // the catch right after it and before the setHeader lines.
  const setHeaderAnchor = "    res.setHeader('Content-Type', result.mimeType);";
  c = c.replace(setHeaderAnchor, closeBlock.replace(/\n/g, '\n') + '\n' + setHeaderAnchor, 1);
  // Fix: the try block now needs its call close "});" not "});\n" — already there.
  // Ensure the try doesn't accidentally swallow the setHeader:
  // (structure: try { result = await ...({...}); } catch ... then setHeader)
  writeFile(CTRL, c, crlf);
  console.log('[OK] export.controller.ts => PATCHED (error reason returned)');
  return true;
}

// ---- 2) web api.ts -----------------------------------------------------------
function patchApi() {
  if (!fs.existsSync(API)) {
    console.log('[ERROR] missing ' + API);
    return false;
  }
  const { text, crlf } = readFile(API);
  if (text.includes('Export failed (${response.status})${detail')) {
    console.log('[OK] web reports api.ts => already fixed');
    return true;
  }
  const oldLine = '  if (!response.ok) throw new Error(`Export failed (${response.status})`);';
  const newBlock = [
    '  if (!response.ok) {',
    '    // Read the response body (JSON { error: { message } }) so the real cause',
    "    // of a failed export is shown instead of a generic status code.\n    let detail = '';\n    try {\n      const body = await response.json();\n      detail = typeof body?.error?.message === 'string' ? body.error.message : '';\n    } catch {\n      detail = '';\n    }\n    throw new Error(`Export failed (${response.status})${detail ? ': ' + detail.slice(0, 300) : ''}`);\n  }",
  ].join('\n');
  if (!text.includes(oldLine)) {
    console.log('[ERROR] web reports api.ts: old error line not found');
    return false;
  }
  writeFile(API, text.replace(oldLine, newBlock, 1), crlf);
  console.log('[OK] web reports api.ts => PATCHED (error detail shown)');
  return true;
}

// ---- verify ------------------------------------------------------------------
function verify() {
  const okC = fs.existsSync(CTRL) && fs.readFileSync(CTRL, 'utf8').includes('EXPORT_FAILED:');
  const okA = fs.existsSync(API) && fs.readFileSync(API, 'utf8').includes('detail.slice(0, 300)');
  console.log('VERIFY: ' + (okC && okA ? 'ALL OK' : 'FAILED'));
  return okC && okA;
}

console.log('AssetX - export error diagnosis');
console.log('--------------------------------');
console.log('[INFO] project root = ' + ROOT);
const a = patchController();
const b = patchApi();
const v = verify();
if (a && b && v) {
  console.log('DONE. restart needed: close the 3 windows, run StartX.bat.');
  console.log('Then try the export again. If it fails, a message will show the');
  console.log('REAL reason (e.g. a missing column name) - send that message back.');
} else {
  console.log('NOT DONE - see errors above.');
  process.exitCode = 1;
}

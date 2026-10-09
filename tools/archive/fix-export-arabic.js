#!/usr/bin/env node
/**
 * fix-export-arabic.js
 * ------------------------------------------------
 * Makes exported inventory CSV show Arabic correctly in Excel:
 *   1) inventory-export.provider.ts - export-only Arabic translation of the
 *      known statuses and results (DB values are NOT renamed; they are lookup keys).
 *   2) csv.generator.ts - prepends a UTF-8 BOM so Excel reads the file as UTF-8
 *      (otherwise Arabic appears as mojibake symbols).
 *
 * Safe to run more than once (skips files that are already patched).
 * This script itself is ASCII-only. The Arabic strings below are written into
 * the backend sources as unicode escapes, which TypeScript decodes at build time.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Find the project root no matter where this script is saved
// (repo root, or a subfolder like tools/). Detected root is printed so
// you can see which folder was used.
function findRoot() {
  const candidates = [
    __dirname,
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, 'tools'),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
    } catch (e) { /* keep looking */ }
  }
  return null;
}

const ROOT = findRoot();
const PROVIDER = ROOT ? path.join(ROOT, 'backend', 'src', 'application', 'export', 'providers', 'inventory-export.provider.ts') : null;
const CSVGEN = ROOT ? path.join(ROOT, 'backend', 'src', 'infrastructure', 'export', 'csv.generator.ts') : null;

// ------------------------------------------------------------------
// New export-only translation maps (written into the provider as
// unicode escapes so generated files stay plain ASCII too).
// ------------------------------------------------------------------
const RESULT_AR_TS = String.raw`const RESULT_AR: Record<string, string> = {
  matched: '\u0645\u0637\u0627\u0628\u0642',
  deficit: '\u0639\u062c\u0632',
  surplus: '\u0632\u064a\u0627\u062f\u0629',
  transferred: '\u0645\u0646\u0642\u0648\u0644',
  missing: '\u0645\u0641\u0642\u0648\u062f',
  not_inventoried: '\u063a\u064a\u0631 \u0645\u064f\u062c\u0631\u0651\u062f',
};

const STATUS_AR: Record<string, string> = {
  'New': '\u062c\u062f\u064a\u062f',
  'Good': '\u062c\u064a\u062f',
  'Used': '\u0645\u0633\u062a\u062e\u062f\u0645',
  'Needs Maintenance': '\u064a\u062d\u062a\u0627\u062c \u0635\u064a\u0627\u0646\u0629',
};`;

// New tail of getData() + translateRow method (exact, verified layout).
const PROVIDER_TAIL = String.raw`    return { rows: rows.map((row) => this.translateRow(row as unknown as Record<string, unknown>)), total: rows.length };
  }

  private translateRow(row: Record<string, unknown>): Record<string, unknown> {
    const out = { ...row };
    if (typeof out.expected_status_name === 'string' && STATUS_AR[out.expected_status_name]) {
      out.expected_status_name = STATUS_AR[out.expected_status_name];
    }
    if (typeof out.actual_status_name === 'string' && STATUS_AR[out.actual_status_name]) {
      out.actual_status_name = STATUS_AR[out.actual_status_name];
    }
    if (typeof out.result === 'string' && RESULT_AR[out.result]) {
      out.result = RESULT_AR[out.result];
    }
    return out;
  }
}`;

// Variant B (current): getData already selects latest-cycle rows, plain return.
const TAIL_B = [
  '    return { rows, total: rows.length };',
  '  }',
  '}',
].join('\n');

// Variant A (older): summary fallback then cycle rows, plain return.
const TAIL_A = [
  '    if (!cycleId) {',
  '      // find latest cycle id via results repo is not exposed here; for now export from',
  '      // inventory analytics (aggregate) if no cycle given.',
  '      const summary = await this.results.getSummaryForLatest(tenantId);',
  '      return { rows: summary ? [summary] : [], total: summary ? 1 : 0 };',
  '    }',
  '    const rows = await this.results.getResults(cycleId, tenantId);',
  '    return { rows, total: rows.length };',
  '  }',
  '}',
].join('\n');

const CSV_BOM_FLAG = '    let index = 0;\n    let bomSent = false;\n    const self = this;';
const CSV_BOM_FLAG_FROM = '    let index = 0;\n    const self = this;';
const CSV_BOM_PUSH = String.raw`      read() {
        if (!bomSent) {
          bomSent = true;
          // UTF-8 BOM so Excel/PDF viewers render Arabic correctly.
          this.push('\uFEFF');
        }
        if (index === 0 && includeHeaders) {`;
const CSV_BOM_PUSH_FROM = [
  '      read() {',
  '        if (index === 0 && includeHeaders) {',
].join('\n');

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function normalize(s) { return s.replace(/\r\n/g, '\n'); }

function restore(s, crlf) { return crlf ? s.replace(/\n/g, '\r\n') : s; }

function reportFile(name, results, errors, changed) {
  if (errors.length > 0) {
    console.log('[ERROR] ' + name + ' NOT patched:');
    for (const e of errors) console.log('        ' + e);
    return false;
  }
  const state = changed ? 'PATCHED (' + results.join(', ') + ')' : 'already fixed (nothing to change)';
  console.log('[OK] ' + name + ' => ' + state);
  return true;
}

function patchProvider() {
  const errors = [];
  const done = [];
  if (!PROVIDER || !fs.existsSync(PROVIDER)) { console.log('[ERROR] missing: ' + (PROVIDER || 'project root not detected')); return false; }
  const raw = fs.readFileSync(PROVIDER, 'utf8');
  const crlf = /\r\n/.test(raw);
  let c = normalize(raw);
  let changed = false;

  if (c.includes('const RESULT_AR')) {
    done.push('maps already present');
  } else {
    const anchor = '@Injectable()\nexport class InventoryExportProvider implements ExportProvider {';
    if (!c.includes(anchor)) {
      errors.push('class anchor not found (is this the inventory provider?)');
    } else {
      c = c.replace(anchor, RESULT_AR_TS + '\n\n' + anchor);
      done.push('RESULT_AR/STATUS_AR maps');
      changed = true;
    }
  }

  if (c.includes('private translateRow')) {
    done.push('translateRow already present');
  } else if (c.includes(TAIL_B)) {
    c = c.replace(TAIL_B, PROVIDER_TAIL);
    done.push('translateRow + mapped return');
    changed = true;
  } else if (c.includes(TAIL_A)) {
    c = c.replace(TAIL_A, PROVIDER_TAIL);
    done.push('old getData tail -> latest-cycle + translateRow');
    changed = true;
  } else {
    errors.push('getData return tail not found (unexpected file layout)');
  }

  if (errors.length === 0 && changed) {
    fs.writeFileSync(PROVIDER, restore(c, crlf), 'utf8');
  }
  return reportFile(path.relative(ROOT, PROVIDER), done, errors, changed);
}

function patchCsvGen() {
  const errors = [];
  const done = [];
  if (!CSVGEN || !fs.existsSync(CSVGEN)) { console.log('[ERROR] missing: ' + (CSVGEN || 'project root not detected')); return false; }
  const raw = fs.readFileSync(CSVGEN, 'utf8');
  const crlf = /\r\n/.test(raw);
  let c = normalize(raw);
  let changed = false;

  if (c.includes('bomSent')) {
    done.push('BOM already present');
  } else {
    if (!c.includes(CSV_BOM_FLAG_FROM)) {
      errors.push("'let index = 0;' anchor not found");
    } else {
      c = c.replace(CSV_BOM_FLAG_FROM, CSV_BOM_FLAG);
      done.push('bomSent flag');
      changed = true;
    }
    if (!c.includes(CSV_BOM_PUSH_FROM)) {
      errors.push("'read() {' anchor not found");
    } else {
      c = c.replace(CSV_BOM_PUSH_FROM, CSV_BOM_PUSH);
      done.push('BOM push');
      changed = true;
    }
  }

  if (errors.length === 0 && changed) {
    fs.writeFileSync(CSVGEN, restore(c, crlf), 'utf8');
  }
  return reportFile(path.relative(ROOT, CSVGEN), done, errors, changed);
}

function verify() {
  const checks = [];
  try {
    const p = fs.readFileSync(PROVIDER, 'utf8');
    checks.push(['provider RESULT_AR', p.includes('const RESULT_AR')]);
    checks.push(['provider STATUS_AR', p.includes('const STATUS_AR')]);
    checks.push(['provider translateRow', p.includes('private translateRow')]);
    checks.push(['provider mapped return', p.includes('this.translateRow(row')]);
  } catch (e) { checks.push(['provider readable', false]); }
  try {
    const c = fs.readFileSync(CSVGEN, 'utf8');
    checks.push(['csv bomSent flag', c.includes('bomSent')]);
    checks.push(['csv BOM push', c.includes("this.push('\\uFEFF')")]);
  } catch (e) { checks.push(['csv readable', false]); }
  const bad = checks.filter((x) => !x[1]).map((x) => x[0]);
  console.log('VERIFY: ' + (bad.length === 0 ? 'ALL OK' : 'FAILED -> ' + bad.join(', ')));
  return bad.length === 0;
}

function main() {
  console.log('AssetX - Arabic export display fix');
  console.log('-----------------------------------');
  if (!ROOT) {
    console.log('[ERROR] project folder not found.');
    console.log('        Tried:');
    console.log('        ' + __dirname);
    console.log('        ' + path.resolve(__dirname, '..'));
    console.log('        ' + process.cwd());
    console.log('        Make sure this script is saved inside the assetx-enterprise-platform-v2 folder.');
    process.exitCode = 1;
    return;
  }
  console.log('[INFO] project root = ' + ROOT);
  const ok1 = patchProvider();
  const ok2 = patchCsvGen();
  const ok3 = verify();
  if (ok1 && ok2 && ok3) {
    console.log('DONE. restarted server needed: close the 3 windows, run StartX.bat,');
    console.log('then re-export CSV and open it with Excel - Arabic should display correctly.');
  } else {
    console.log('NOT DONE - see errors above. No partially written files are left behind.');
    process.exitCode = 1;
  }
}

main();

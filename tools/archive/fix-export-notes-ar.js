#!/usr/bin/env node
/**
 * fix-export-notes-ar.js
 * ------------------------------------------------
 * Extends the export Arabic fix: inside the saved "condition detail" line that
 * the mobile app writes into the notes field (e.g. "condition detail: New:2 |
 * Needs Maintenance:1"), the known status names are translated to Arabic at
 * export time only: New -> new, Needs Maintenance -> needs maintenance,
 * Damaged -> damaged, Good -> good, Used -> used.
 *
 * Requires the previous fix (fix-export-arabic.js) to be applied first
 * (the provider must already contain translateRow + the BOM in csv.generator.ts).
 *
 * Safe to run more than once (skips files that are already patched).
 * This script itself is ASCII-only; Arabic is written as unicode escapes,
 * which TypeScript decodes at build time.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Find the project root no matter where this script is saved
// (repo root, or a subfolder like tools/).
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
// Condition-name map (written into the provider as unicode escapes).
// "condition detail:" prefix used by the mobile app's saved line.
// Written as escapes below: \u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u062d\u0627\u0644\u0629
// ------------------------------------------------------------------
const CONDITION_AR_TS = String.raw`const CONDITION_AR: Record<string, string> = {
  'New': '\u062c\u062f\u064a\u062f',
  'Good': '\u062c\u064a\u062f',
  'Used': '\u0645\u0633\u062a\u062e\u062f\u0645',
  'Needs Maintenance': '\u064a\u062d\u062a\u0627\u062c \u0635\u064a\u0627\u0646\u0629',
  'Damaged': '\u062a\u0627\u0644\u0641',
};`;

const STATUS_ANCHOR = 'const STATUS_AR: Record<string, string> = {';

// Exact current translateRow (as produced by fix-export-arabic.js).
const OLD_TRANSLATE_ROW = [
  '  private translateRow(row: Record<string, unknown>): Record<string, unknown> {',
  '    const out = { ...row };',
  "    if (typeof out.expected_status_name === 'string' && STATUS_AR[out.expected_status_name]) {",
  '      out.expected_status_name = STATUS_AR[out.expected_status_name];',
  '    }',
  "    if (typeof out.actual_status_name === 'string' && STATUS_AR[out.actual_status_name]) {",
  '      out.actual_status_name = STATUS_AR[out.actual_status_name];',
  '    }',
  "    if (typeof out.result === 'string' && RESULT_AR[out.result]) {",
  '      out.result = RESULT_AR[out.result];',
  '    }',
  '    return out;',
  '  }',
].join('\n');

// Replaced by: notes translation + new helper method.
const NEW_TRANSLATE_ROW = String.raw`  private translateRow(row: Record<string, unknown>): Record<string, unknown> {
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
    if (typeof out.notes === 'string') {
      out.notes = this.translateConditionNotes(out.notes);
    }
    return out;
  }

  // Export-only: translate known status names inside a saved condition-detail
  // line (e.g. "\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u062d\u0627\u0644\u0629: New:2 | Needs Maintenance:1")
  // so the exported file reads in Arabic. DB data is never modified.
  private translateConditionNotes(notes: string): string {
    const match = notes.match(/\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u062d\u0627\u0644\u0629:\s*([^\n]*)/);
    if (!match) return notes;
    const translated = match[1]
      .split('|')
      .map((part) => {
        const trimmed = part.trim();
        const colon = trimmed.indexOf(':');
        if (colon < 0) return trimmed;
        const name = trimmed.slice(0, colon).trim();
        const qty = trimmed.slice(colon + 1).trim();
        const ar = CONDITION_AR[name];
        return ar ? ar + ':' + qty : trimmed;
      })
      .join(' | ');
    return notes.replace(match[0], '\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u062d\u0627\u0644\u0629: ' + translated);
  }`;

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

  // The previous fix must be applied first.
  if (!c.includes('private translateRow')) {
    errors.push('translateRow not found - run fix-export-arabic.js FIRST, then re-run this script.');
  }

  if (errors.length === 0) {
    if (c.includes('const CONDITION_AR')) {
      done.push('CONDITION_AR already present');
    } else if (!c.includes(STATUS_ANCHOR)) {
      errors.push('STATUS_AR block not found (unexpected file layout)');
    } else {
      c = c.replace(STATUS_ANCHOR, CONDITION_AR_TS + '\n\n' + STATUS_ANCHOR);
      done.push('CONDITION_AR map');
      changed = true;
    }
  }

  if (errors.length === 0) {
    if (c.includes('private translateConditionNotes')) {
      done.push('translateConditionNotes already present');
    } else if (!c.includes(OLD_TRANSLATE_ROW)) {
      errors.push('translateRow body not found (unexpected file layout)');
    } else {
      c = c.replace(OLD_TRANSLATE_ROW, NEW_TRANSLATE_ROW);
      done.push('notes translation + translateConditionNotes');
      changed = true;
    }
  }

  if (errors.length === 0 && changed) {
    fs.writeFileSync(PROVIDER, restore(c, crlf), 'utf8');
  }
  return reportFile(path.relative(ROOT, PROVIDER), done, errors, changed);
}

function verify() {
  const checks = [];
  try {
    const p = fs.readFileSync(PROVIDER, 'utf8');
    checks.push(['provider RESULT_AR', p.includes('const RESULT_AR')]);
    checks.push(['provider STATUS_AR', p.includes('const STATUS_AR')]);
    checks.push(['provider CONDITION_AR', p.includes('const CONDITION_AR')]);
    checks.push(['provider translateRow', p.includes('private translateRow')]);
    checks.push(['provider notes call', p.includes('this.translateConditionNotes(out.notes)')]);
    checks.push(['provider helper', p.includes('private translateConditionNotes')]);
  } catch (e) { checks.push(['provider readable', false]); }
  try {
    const c = fs.readFileSync(CSVGEN, 'utf8');
    checks.push(['csv BOM push', c.includes("this.push('\\uFEFF')")]);
  } catch (e) { checks.push(['csv readable', false]); }
  const bad = checks.filter((x) => !x[1]).map((x) => x[0]);
  console.log('VERIFY: ' + (bad.length === 0 ? 'ALL OK' : 'FAILED -> ' + bad.join(', ')));
  return bad.length === 0;
}

function main() {
  console.log('AssetX - Arabic condition-detail line in export');
  console.log('-----------------------------------------------');
  if (!ROOT) {
    console.log('[ERROR] project folder not found.');
    console.log('        Make sure this script is saved inside the assetx-enterprise-platform-v2 folder.');
    process.exitCode = 1;
    return;
  }
  console.log('[INFO] project root = ' + ROOT);
  const ok1 = patchProvider();
  const ok2 = verify();
  if (ok1 && ok2) {
    console.log('DONE. restarted server needed: close the 3 windows, run StartX.bat,');
    console.log('then re-export CSV and open it with Excel - the condition detail line');
    console.log('will show Arabic names (e.g. "\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u062d\u0627\u0644\u0629: \u062c\u062f\u064a\u062f:2 | \u064a\u062d\u062a\u0627\u062c \u0635\u064a\u0627\u0646\u0629:1").');
  } else {
    console.log('NOT DONE - see errors above. No partially written files are left behind.');
    process.exitCode = 1;
  }
}

main();

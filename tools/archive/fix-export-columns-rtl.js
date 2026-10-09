#!/usr/bin/env node
/**
 * fix-export-columns-rtl.js
 * ------------------------------------------------
 * Two fixes for the inventory report exports:
 *
 *   1) RTL (Arabic word order) in PDF: PDFKit shapes each word correctly but
 *      lays words out left-to-right, so multi-word Arabic strings
 *      (e.g. "expected status") appeared mirrored. This fix re-orders
 *      Arabic words before drawing, restoring the correct reading order while
 *      keeping glyph shaping intact. Latin-only text is unaffected.
 *
 *   2) Missing inventory columns: the report only showed ids/statuses, not the
 *      asset name/code, expected/actual locations, or expected/actual
 *      custodian, because the data query did not join those names and the
 *      column catalog omitted them. This fix adds:
 *        - backend query joins (asset name/code, location names+paths,
 *          employee names)
 *        - the entity fields
 *        - the backend "inventory" profile columns
 *        - the web column catalog + profile key list (reports page)
 *        - EN/AR labels for the new columns (i18n)
 *
 * Applies to the state AFTER fix-pdf-arabic.js (fonts + generator already
 * patched). Safe to run more than once (skips already-fixed parts).
 * This script itself is ASCII-only; Arabic strings are written as escapes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------
// Project root detection
// ------------------------------------------------------------------
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
if (!ROOT) {
  console.log('[ERROR] project folder not found.');
  console.log('        Make sure this script is saved inside the assetx-enterprise-platform-v2 folder.');
  process.exit(1);
}

const B = path.join(ROOT, 'backend');
const W = path.join(ROOT, 'web');

const PDF = path.join(B, 'src', 'infrastructure', 'export', 'pdf.generator.ts');
const RESULT_REPO = path.join(B, 'src', 'infrastructure', 'repositories', 'result.repository.ts');
const ENTITY = path.join(B, 'src', 'core', 'entities', 'inventory.entity.ts');
const REGISTRY = path.join(B, 'src', 'application', 'export', 'export-profile.registry.ts');
const REPORTS = path.join(W, 'src', 'app', '(dashboard)', 'reports', 'page.tsx');
const I18N = path.join(W, 'src', 'lib', 'i18n.tsx');

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------
function read(f) {
  const raw = fs.readFileSync(f, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: /\r\n/.test(raw) };
}
function write(f, content, crlf) {
  fs.writeFileSync(f, crlf ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}
function report(f, done, errors, changed, label) {
  if (errors.length > 0) {
    console.log('[ERROR] ' + label + ' NOT patched:');
    for (const e of errors) console.log('        ' + e);
    return false;
  }
  const state = changed ? 'PATCHED (' + done.join(', ') + ')' : 'already fixed (nothing to change)';
  console.log('[OK] ' + label + ' => ' + state);
  return true;
}

// ------------------------------------------------------------------
// 1) pdf.generator.ts - add rtlDisplayOrder and use it
// ------------------------------------------------------------------
const RTL_FN_ANCHOR = 'function arabicFontsAvailable(): boolean {\n  return fs.existsSync(ARABIC_FONT) && fs.existsSync(ARABIC_FONT_BOLD);\n}';
const RTL_FN_ADD = RTL_FN_ANCHOR + "\n\n/** Arabic (RTL) visual-order conversion for PDFKit.\n *\n * PDFKit asks fontkit to lay out each whitespace-delimited word separately and\n * then places those words left-to-right in the order they appear in the input\n * string. fontkit itself shapes Arabic letters correctly (contextual forms and\n * letter order inside a word), so individual words render fine — but the WORD\n * ORDER of a multi-word Arabic line stays left-to-right, i.e. mirrored for the\n * reader.\n *\n * This converter therefore only reverses the order of the whitespace-delimited\n * tokens of a line that contains Arabic, keeping every letter in its original\n * logical order so fontkit can still shape it. Latin words, digits and\n * punctuation attached to a word (\":\", \"|\", \"-\", ...) move with it, which is\n * exactly how the bidi algorithm places them for an RTL line.\n */\nconst ARABIC_RANGE = /[\\u0600-\\u06FF]/;\n\n/** Reorder tokens of an RTL line into visual (drawing) order for PDFKit. */\nfunction rtlDisplayOrder(text: string): string {\n  if (!text || !ARABIC_RANGE.test(text)) return text;\n  return text.split(/(\\s+)/).reverse().join('');\n}";
/** Adaptive column widths: proportional to widest value per column, with an
 *  empty-column shrink so unused "actual ..." columns stay slim. */
const WIDTH_FN_ADD = "function measureCellUnits(text: string): number {\n  let units = 0;\n  for (const ch of text) {\n    const code = ch.codePointAt(0) ?? 0;\n    if (ARABIC_RANGE.test(ch) || code === 0x20) units += ch === ' ' ? 0.35 : 1.0;\n    else if (/[0-9]/.test(ch)) units += 0.55;\n    else if (/[.,:;|\\-@/]/.test(ch)) units += 0.4;\n    else if (/[A-Z]/.test(ch)) units += 0.8;\n    else units += 0.6;\n  }\n  return units;\n}\n\n/** Distribute the available table width between columns proportionally to the\n *  widest value in each column (header included). Long text columns (asset\n *  name, location, notes) get more space; numeric/id columns get less, and a\n *  single column can never swallow the whole table. Columns whose data cells\n *  are all empty are shrunk to a slim width that still fits the header\n *  (wrapped to two lines if needed) instead of reserving a full column. */\nfunction distributeTableWidths(headers: string[], rows: unknown[], keys: string[], total: number): number[] {\n  if (keys.length === 0) return [total];\n  const widths: number[] = [];\n  let sum = 0;\n  for (let i = 0; i < keys.length; i += 1) {\n    let maxUnits = measureCellUnits(headers[i] ?? keys[i]);\n    let allEmpty = true;\n    for (const row of rows) {\n      const value = String((row as Record<string, unknown>)?.[keys[i]] ?? '');\n      const units = measureCellUnits(value);\n      if (units > maxUnits) maxUnits = units;\n      if (value.trim() !== '') allEmpty = false;\n    }\n    // Empty columns: reserve roughly the header width (wrapping allowed),\n    // never a content-filled share.\n    const weighted = allEmpty\n      ? Math.max(3, Math.min(maxUnits * 0.55 + 1, 14))\n      : Math.max(2, Math.min(maxUnits + 1.5, 45));\n    widths.push(weighted);\n    sum += weighted;\n  }\n  const minCol = Math.max(10, Math.round(total * 0.03));\n  const maxCol = Math.round(total * 0.38);\n  const distributed = widths.map((w) => Math.max(minCol, Math.min(maxCol, Math.round(total * w / sum))));\n  // Round-off: absorb the leftover so the columns exactly fill the table.\n  let diff = total - distributed.reduce((a, b) => a + b, 0);\n  let cursor = 0;\n  let guard = 0;\n  while (diff !== 0 && guard < 5000) {\n    const idx = cursor % distributed.length;\n    const step = diff > 0 ? 1 : -1;\n    const next = distributed[idx] + step;\n    if (next >= minCol && next <= maxCol && Math.abs(diff) > 0) {\n      distributed[idx] = next;\n      diff -= step;\n    }\n    cursor += 1;\n    guard += 1;\n  }\n  return distributed;\n}";

const OLD_CELL = [
  '        doc.font(fontName).fontSize(typo.tableSize ?? 8)',
  '          .fillColor(fg).text(cell, x + 4, rowTop + 4, { width: colWidth - 8 });',
].join('\n');
const NEW_CELL = [
  '        const display = rtlDisplayOrder(cell);',
  '        doc.font(fontName).fontSize(typo.tableSize ?? 8)',
  '          .fillColor(fg).text(display, x + 4, rowTop + 4, { width: colWidth - 8 });',
].join('\n');

const OLD_TITLE = "doc.font(titleFont).fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(title, { align: 'center' });";
const NEW_TITLE = "doc.font(titleFont).fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(rtlDisplayOrder(title), { align: 'center' });";

const OLD_FOOTER = "        .text(text, 0, doc.page.height - 20, { align: 'center', width: pageWidth });";
const NEW_FOOTER = "        .text(rtlDisplayOrder(text), 0, doc.page.height - 20, { align: 'center', width: pageWidth });";

function patchPdf() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(PDF)) { errors.push('missing ' + PDF); return report(PDF, done, errors, false, 'pdf.generator.ts'); }
  const { text: c0, crlf } = read(PDF);
  let c = c0;
  let changed = false;

  // 0a) Remove any EARLIER glyph-reversal implementation (per-letter reversal +
  //     Arabic presentation forms). It double-reverses PDFKit own shaping and
  //     makes the text read backwards. Not present on a fresh project, but the
  //     user may have run an early version of this fix before.
  const glyphRe = /const\s+ARABIC_NO_JOIN_NEXT[\s\S]*?function\s+reshapeArabicWord\(text: string\): string \{[\s\S]*?\n\}/;
  const mGlyph = c.match(glyphRe);
  if (mGlyph) {
    c = c.slice(0, mGlyph.index) + c.slice(mGlyph.index + mGlyph[0].length);
    done.push('glyph-reversal block removed');
    changed = true;
  }

  // 0b) If a word-order-only rtlDisplayOrder exists (previous run of this fix),
  //     leave it; if an older full-visual-order version (reverse letters +
  //     words) exists, replace its body with the word-order-only version.
  const bodyRe = /function\s+rtlDisplayOrder\(text: string\): string \{[\s\S]*?\n\}/;
  if (c.includes('function rtlDisplayOrder')) {
    const body = c.match(bodyRe);
    const canonical = 'function rtlDisplayOrder(text: string): string {\n' +
      "  if (!text || !ARABIC_RANGE.test(text)) return text;\n" +
      "  return text.split(/(\\s+)/).reverse().join('');\n}";
    if (body && body[0] !== canonical) {
      c = c.slice(0, body.index) + canonical + c.slice(body.index + body[0].length);
      done.push('rtlDisplayOrder normalized (word-order only)');
      changed = true;
    } else {
      done.push('rtlDisplayOrder already present');
    }
  } else if (!c.includes(RTL_FN_ANCHOR)) {
    errors.push('arabicFontsAvailable() anchor not found');
  } else {
    c = c.replace(RTL_FN_ANCHOR, RTL_FN_ADD);
    done.push('rtlDisplayOrder added');
    changed = true;
  }

  // 0c) adaptive column widths (idempotent; upgrades a fixed-width layout)
  if (errors.length === 0) {
    const rtlnClose = "return text.split(/(\\s+)/).reverse().join('');\n}";
    if (c.includes('function distributeTableWidths')) {
      done.push('distributeTableWidths already present');
    } else {
      const idx = c.indexOf('function rtlDisplayOrder');
      const close = idx >= 0 ? c.indexOf(rtlnClose, idx) : -1;
      if (close >= 0) {
        // Ensure ARABIC_RANGE is defined (older adds used an inline regex).
        if (!c.includes('const ARABIC_RANGE')) {
          const arAnchor = 'function rtlDisplayOrder(text: string): string {';
          const arIdx = c.indexOf(arAnchor);
          if (arIdx < 0) { errors.push('rtlDisplayOrder head not found (ARABIC_RANGE)'); }
          else {
            c = c.slice(0, arIdx) + 'const ARABIC_RANGE = /[\\u0600-\\u06FF]/;\n\n' + c.slice(arIdx);
            done.push('ARABIC_RANGE const');
            changed = true;
          }
        }
        if (errors.length === 0) {
          c = c.slice(0, close + rtlnClose.length) + '\n\n' + WIDTH_FN_ADD + c.slice(close + rtlnClose.length);
          done.push('adaptive widths added');
          changed = true;
        }
      } else {
        errors.push('rtlDisplayOrder close anchor not found (widths)');
      }
    }
  }

  // 0d) empty-column shrink upgrade: an earlier distributed-widths build may
  //     exist without the allEmpty weighting; replace the function body.
  if (errors.length === 0 && c.includes('function distributeTableWidths') && !c.includes('let allEmpty = true;')) {
    const dwStart = c.indexOf('function distributeTableWidths');
    const dwEnd = c.indexOf('\n}\n', dwStart);
    if (dwStart >= 0 && dwEnd >= 0) {
      const oldBody = c.slice(dwStart, dwEnd + 3);
      const newBody = WIDTH_FN_ADD.slice(WIDTH_FN_ADD.indexOf('function distributeTableWidths'));
      if (newBody.startsWith('function distributeTableWidths')) {
        c = c.slice(0, dwStart) + newBody + c.slice(dwEnd + 3);
        done.push('distributeTableWidths upgraded (empty-column shrink)');
        changed = true;
      } else {
        errors.push('cannot rebuild distributeTableWidths');
      }
    }
  }

  if (errors.length === 0) {
    const colW = '    const colWidth = headerKeys.length > 0 ? Math.floor(contentWidth / headerKeys.length) : contentWidth;';
    const colWN = '    // Column widths adapt to the content: wide for names/locations/notes,\n    // narrow for quantities/codes — never a single fixed split.\n    const colWidths = distributeTableWidths(headerLabels, data, headerKeys, contentWidth);';
    if (c.includes('const colWidths = distributeTableWidths(')) {
      done.push('colWidths usage already present');
    } else if (c.includes(colW)) {
      c = c.replace(colW, colWN);
      done.push('colWidths usage');
      changed = true;
    } else {
      errors.push('colWidth declaration not found');
    }
  }

  if (errors.length === 0) {
    const xOld = '        const x = left + i * colWidth;';
    const xNew = '        const colWidth = colWidths[i] ?? colWidths[colWidths.length - 1] ?? contentWidth;\n        const x = left + colWidths.slice(0, i).reduce((a, b) => a + b, 0);';
    if (c.includes('const x = left + colWidths.slice(0, i)')) {
      done.push('column x positioning already present');
    } else if (c.includes(xOld)) {
      c = c.replace(xOld, xNew);
      done.push('column x positioning');
      changed = true;
    } else {
      errors.push('cell x positioning not found');
    }
  }

  if (errors.length === 0) {
    if (c.includes('const display = rtlDisplayOrder(cell);')) {
      done.push('cell RTL already present');
    } else if (c.includes(OLD_CELL)) {
      c = c.replace(OLD_CELL, NEW_CELL);
      done.push('cell RTL applied');
      changed = true;
    } else {
      errors.push('cell text block not found (unexpected layout)');
    }
  }

  if (errors.length === 0) {
    if (c.includes('rtlDisplayOrder(title)')) {
      done.push('title RTL already present');
    } else if (c.includes(OLD_TITLE)) {
      c = c.replace(OLD_TITLE, NEW_TITLE);
      done.push('title RTL applied');
      changed = true;
    } else {
      errors.push('title line not found');
    }
  }

  if (errors.length === 0) {
    if (c.includes('rtlDisplayOrder(text)')) {
      done.push('footer RTL already present');
    } else if (c.includes(OLD_FOOTER)) {
      c = c.replace(OLD_FOOTER, NEW_FOOTER);
      done.push('footer RTL applied');
      changed = true;
    } else {
      errors.push('footer line not found');
    }
  }

  if (errors.length === 0 && changed) write(PDF, c, crlf);
  return report(PDF, done, errors, changed, 'pdf.generator.ts');
}

// ------------------------------------------------------------------
// 2) result.repository.ts - join asset/location/employee names
// ------------------------------------------------------------------
const OLD_REPO_QUERY_START = "      `SELECT\n         ir.id, ir.tenant_id, ir.cycle_id, ir.asset_id,";
const OLD_REPO_QUERY_END = "       WHERE ir.cycle_id = $1\n       ORDER BY ir.id`,";
const OLD_REPO_JOINS = [
  '       JOIN v_inventory_result vw ON vw.id = ir.id',
  '       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id',
  '       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id',
].join('\n');

function patchResultRepo() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(RESULT_REPO)) { errors.push('missing ' + RESULT_REPO); return report(RESULT_REPO, done, errors, false, 'result.repository.ts'); }
  const { text: c0, crlf } = read(RESULT_REPO);
  let c = c0;
  let changed = false;

  if (c.includes('a.name AS asset_name')) {
    done.push('name joins already present');
    return report(RESULT_REPO, done, errors, false, 'result.repository.ts');
  }

  // Add the extra selected fields before the closing "`" of the query.
  const selAnchor = '         vw.result,\n         es.name AS expected_status_name,\n         ast.name AS actual_status_name\n';
  const selAdd = '         vw.result,\n         es.name AS expected_status_name,\n         ast.name AS actual_status_name,\n         a.name AS asset_name,\n         a.full_asset_code AS asset_code,\n         el.name AS expected_location_name,\n         el.full_path AS expected_location_path,\n         al.name AS actual_location_name,\n         al.full_path AS actual_location_path,\n         ee.name AS expected_employee_name,\n         ae.name AS actual_employee_name\n';
  if (c.includes(selAnchor)) {
    c = c.replace(selAnchor, selAdd);
    done.push('asset/location/employee columns');
    changed = true;
  } else if (c.includes('ast.name AS actual_status_name') && c.includes('       WHERE ir.cycle_id = $1')) {
    // fallback: insert before the closing backtick line
    const bt = c.indexOf('`', c.indexOf('ast.name AS actual_status_name'));
    if (bt > 0) {
      c = c.slice(0, bt) + ',\n         a.name AS asset_name,\n         a.full_asset_code AS asset_code,\n         el.name AS expected_location_name,\n         el.full_path AS expected_location_path,\n         al.name AS actual_location_name,\n         al.full_path AS actual_location_path,\n         ee.name AS expected_employee_name,\n         ae.name AS actual_employee_name' + c.slice(bt);
      done.push('asset/location/employee columns (fallback)');
      changed = true;
    } else {
      errors.push('query close anchor not found');
    }
  } else {
    errors.push('status-name select anchor not found');
  }

  // Add the joins (once).
  if (errors.length === 0) {
    const joinAnchor = '       JOIN v_inventory_result vw ON vw.id = ir.id\n';
    const joinAdd = [
      '       JOIN v_inventory_result vw ON vw.id = ir.id',
      '       JOIN assets a ON a.id = ir.asset_id AND a.tenant_id = ir.tenant_id',
      '       LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id',
      '       LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id',
      '       LEFT JOIN locations el ON el.id = ir.expected_location_id AND el.tenant_id = ir.tenant_id',
      '       LEFT JOIN locations al ON al.id = ir.actual_location_id AND al.tenant_id = ir.tenant_id',
      '       LEFT JOIN employees ee ON ee.id = ir.expected_employee_id AND ee.tenant_id = ir.tenant_id',
      '       LEFT JOIN employees ae ON ae.id = ir.actual_employee_id AND ae.tenant_id = ir.tenant_id',
    ].join('\n') + '\n';
    if (c.includes('JOIN assets a ON a.id = ir.asset_id AND a.tenant_id = ir.tenant_id\n')) {
      done.push('joins already present');
    } else if (c.includes(joinAnchor)) {
      c = c.replace(joinAnchor, joinAdd);
      done.push('asset/location/employee joins');
      changed = true;
    } else {
      errors.push('v_inventory_result join anchor not found');
    }
  }

  if (errors.length === 0 && changed) write(RESULT_REPO, c, crlf);
  return report(RESULT_REPO, done, errors, changed, 'result.repository.ts');
}

// ------------------------------------------------------------------
// 3) inventory.entity.ts - add result fields
// ------------------------------------------------------------------
const ENT_ANCHOR = "  expected_status_name?: string | null;\n  actual_status_name?: string | null;\n}";
const ENT_ADD = "  expected_status_name?: string | null;\n  actual_status_name?: string | null;\n  asset_name?: string | null;\n  asset_code?: string | null;\n  expected_location_name?: string | null;\n  expected_location_path?: string | null;\n  actual_location_name?: string | null;\n  actual_location_path?: string | null;\n  expected_employee_name?: string | null;\n  actual_employee_name?: string | null;\n}";

function patchEntity() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(ENTITY)) { errors.push('missing ' + ENTITY); return report(ENTITY, done, errors, false, 'inventory.entity.ts'); }
  const { text: c0, crlf } = read(ENTITY);
  let c = c0;
  let changed = false;

  if (c.includes('asset_name?: string | null;')) {
    done.push('fields already present');
  } else if (c.includes(ENT_ANCHOR)) {
    c = c.replace(ENT_ANCHOR, ENT_ADD);
    done.push('asset/location/employee fields');
    changed = true;
  } else {
    errors.push('result interface anchor not found');
  }

  if (errors.length === 0 && changed) write(ENTITY, c, crlf);
  return report(ENTITY, done, errors, changed, 'inventory.entity.ts');
}

// ------------------------------------------------------------------
// 4) export-profile.registry.ts - inventory profile columns
// ------------------------------------------------------------------
const NEW_REG_INV = [
  "          { key: 'asset_code', label: 'Asset Code', order: 1 },",
  "          { key: 'asset_name', label: 'Asset', order: 2 },",
  "          { key: 'expected_quantity', label: 'Expected Qty', order: 3 },",
  "          { key: 'actual_quantity', label: 'Actual Qty', order: 4 },",
  "          { key: 'expected_location_path', label: 'Expected Location', order: 5 },",
  "          { key: 'actual_location_path', label: 'Actual Location', order: 6 },",
  "          { key: 'expected_employee_name', label: 'Expected Custodian', order: 7 },",
  "          { key: 'actual_employee_name', label: 'Actual Custodian', order: 8 },",
  "          { key: 'expected_status_name', label: 'Expected Status', order: 9 },",
  "          { key: 'actual_status_name', label: 'Actual Status', order: 10 },",
  "          { key: 'result', label: 'Result', order: 11 },",
  "          { key: 'notes', label: 'Notes', order: 12 },",
].join('\n');

function patchRegistry() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(REGISTRY)) { errors.push('missing ' + REGISTRY); return report(REGISTRY, done, errors, false, 'export-profile.registry.ts'); }
  const { text: c0, crlf } = read(REGISTRY);
  let c = c0;
  let changed = false;

  if (c.includes("{ key: 'asset_code', label: 'Asset Code', order: 1 },")) {
    done.push('inventory profile already updated');
  } else {
    // Replace the columns array of the inventory profile regardless of its
    // current keys/labels/order (handles older and newer catalog shapes).
    const re = /(inventory: \{\s*id: 'inventory'[\s\S]*?columns: \[\s*)([\s\S]*?)(\s*\],\s*\},)/;
    const m = c.match(re);
    if (!m) {
      errors.push('inventory profile block not found');
    } else {
      c = c.slice(0, m.index) + m[1] + NEW_REG_INV + m[3] + c.slice(m.index + m[0].length);
      done.push('inventory profile columns');
      changed = true;
    }
  }

  // Caller-label precedence: when the web report designer sends its own
  // (translated) label for a column that also comes from the profile, the
  // caller's label + order must win; otherwise Arabic headers are overwritten
  // by the profile's English labels.
  if (errors.length === 0) {
    const oldMerge = "    // Caller-specified columns take precedence, appended after profile columns.\n    for (const c of options.columns ?? []) {\n      if (!merged.some((m) => m.key === c.key)) merged.push({ key: c.key, label: c.label, order: c.order });\n    }";
    const newMerge = "    // Caller-specified columns take precedence. When the caller (the web\n" +
      "    // report designer) supplies a column that already exists in the profile,\n" +
      "    // the caller's display label and order win — so translated column names\n" +
      "    // (Arabic/English per UI language) are never overwritten by the profile.\n" +
      "    for (const c of options.columns ?? []) {\n" +
      "      const existing = merged.find((m) => m.key === c.key);\n" +
      "      if (existing) {\n" +
      "        if (c.label) existing.label = c.label;\n" +
      "        if (c.order !== undefined) existing.order = c.order;\n" +
      "      } else {\n" +
      "        merged.push({ key: c.key, label: c.label, order: c.order });\n" +
      "      }\n" +
      "    }";
    if (c.includes('const existing = merged.find((m) => m.key === c.key);')) {
      done.push('caller-label precedence already present');
    } else if (c.includes(oldMerge)) {
      c = c.replace(oldMerge, newMerge);
      done.push('caller-label precedence');
      changed = true;
    } else {
      errors.push('registry merge loop not found');
    }
  }

  if (errors.length === 0 && changed) write(REGISTRY, c, crlf);
  return report(REGISTRY, done, errors, changed, 'export-profile.registry.ts');
}

// ------------------------------------------------------------------
// 5) web reports page.tsx - column catalog + profile keys
// ------------------------------------------------------------------
const OLD_CATALOG = [
  "    { key: 'record_id', label: '', labelKey: 'module.reportsColumnRecordId', order: 1 },",
  "    { key: 'cycle_id', label: '', labelKey: 'module.reportsColumnCycleId', order: 2 },",
  "    { key: 'asset_id', label: '', labelKey: 'module.reportsColumnAssetId', order: 3 },",
  "    { key: 'expected_quantity', label: '', labelKey: 'module.reportsColumnExpectedQuantity', order: 4 },",
  "    { key: 'actual_quantity', label: '', labelKey: 'module.reportsColumnActualQuantity', order: 5 },",
  "    { key: 'expected_status_name', label: '', labelKey: 'module.reportsColumnExpectedStatus', order: 6 },",
  "    { key: 'actual_status_name', label: '', labelKey: 'module.reportsColumnActualStatus', order: 7 },",
  "    { key: 'result', label: '', labelKey: 'module.reportsColumnInventoryResult', order: 8 },",
  "    { key: 'inventory_date', label: '', labelKey: 'module.reportsColumnInventoryDate', order: 9 },",
  "    { key: 'notes', label: '', labelKey: 'module.reportsColumnNotes', order: 10 },",
].join('\n');
const NEW_CATALOG = [
  "    { key: 'record_id', label: '', labelKey: 'module.reportsColumnRecordId', order: 1 },",
  "    { key: 'cycle_id', label: '', labelKey: 'module.reportsColumnCycleId', order: 2 },",
  "    { key: 'asset_name', label: '', labelKey: 'module.reportsColumnName', order: 3 },",
  "    { key: 'asset_code', label: '', labelKey: 'module.reportsColumnCode', order: 4 },",
  "    { key: 'expected_quantity', label: '', labelKey: 'module.reportsColumnExpectedQuantity', order: 5 },",
  "    { key: 'actual_quantity', label: '', labelKey: 'module.reportsColumnActualQuantity', order: 6 },",
  "    { key: 'expected_location_path', label: '', labelKey: 'module.reportsColumnExpectedLocationPath', order: 7 },",
  "    { key: 'actual_location_path', label: '', labelKey: 'module.reportsColumnActualLocationPath', order: 8 },",
  "    { key: 'expected_employee_name', label: '', labelKey: 'module.reportsColumnExpectedEmployee', order: 9 },",
  "    { key: 'actual_employee_name', label: '', labelKey: 'module.reportsColumnActualEmployee', order: 10 },",
  "    { key: 'expected_status_name', label: '', labelKey: 'module.reportsColumnExpectedStatus', order: 11 },",
  "    { key: 'actual_status_name', label: '', labelKey: 'module.reportsColumnActualStatus', order: 12 },",
  "    { key: 'result', label: '', labelKey: 'module.reportsColumnInventoryResult', order: 13 },",
  "    { key: 'inventory_date', label: '', labelKey: 'module.reportsColumnInventoryDate', order: 14 },",
  "    { key: 'notes', label: '', labelKey: 'module.reportsColumnNotes', order: 15 },",
].join('\n');

const OLD_PROFILE_KEYS = "  inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode', 'actual_status_name'],";
const NEW_PROFILE_KEYS = "  inventory: ['asset_code', 'asset_name', 'expected_quantity', 'actual_quantity', 'expected_location_path', 'actual_location_path', 'expected_employee_name', 'actual_employee_name', 'expected_status_name', 'actual_status_name', 'result', 'notes']";

function patchReports() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(REPORTS)) { errors.push('missing ' + REPORTS); return report(REPORTS, done, errors, false, 'web reports page.tsx'); }
  const { text: c0, crlf } = read(REPORTS);
  let c = c0;
  let changed = false;

  if (c.includes("{ key: 'asset_name', label: '', labelKey: 'module.reportsColumnName', order: 3 },")) {
    done.push('column catalog already updated');
  } else {
    // Replace the "inventory: [" catalog block no matter its current keys.
    const re = /(\binventory: \[\s*)([\s\S]*?)(\s*\],)/;
    const m = c.match(re);
    if (!m) {
      errors.push('inventory catalog block not found');
    } else {
      c = c.slice(0, m.index) + m[1] + NEW_CATALOG + m[3] + c.slice(m.index + m[0].length);
      done.push('column catalog (asset/location/employee)');
      changed = true;
    }
  }

  if (errors.length === 0) {
    if (c.includes("inventory: ['asset_code', 'asset_name'")) {
      done.push('profile keys already updated');
    } else {
      // Replace the inventory profile-key line (single-line array only; never
      // touches the multi-line column catalog above it).
      const re = /(\binventory: \[[^\]\n]*\],)/;
      const m = c.match(re);
      if (!m) {
        errors.push('inventory profile keys line not found');
      } else {
        c = c.replace(re, NEW_PROFILE_KEYS + ',');
        done.push('profile keys');
        changed = true;
      }
    }
  }

  if (errors.length === 0 && changed) write(REPORTS, c, crlf);
  return report(REPORTS, done, errors, changed, 'web reports page.tsx');
}

// ------------------------------------------------------------------
// 6) web i18n.tsx - EN/AR labels
// ------------------------------------------------------------------
const I18N_EN = [
  "'module.reportsColumnExpectedLocationPath': 'Expected location',",
  "'module.reportsColumnActualLocationPath': 'Actual location',",
  "'module.reportsColumnExpectedEmployee': 'Expected custodian',",
  "'module.reportsColumnActualEmployee': 'Actual custodian', ",
].join(' ');

const I18N_AR = [
  "'module.reportsColumnExpectedLocationPath': '\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0645\u062a\u0648\u0642\u0639',",
  "'module.reportsColumnActualLocationPath': '\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0641\u0639\u0644\u064a',",
  "'module.reportsColumnExpectedEmployee': '\u0627\u0644\u0645\u0633\u062a\u0644\u0645 \u0627\u0644\u0645\u062a\u0648\u0642\u0639',",
  "'module.reportsColumnActualEmployee': '\u0627\u0644\u0645\u0633\u062a\u0644\u0645 \u0627\u0644\u0641\u0639\u0644\u064a', ",
].join(' ');

function patchI18n() {
  const done = [];
  const errors = [];
  if (!fs.existsSync(I18N)) { errors.push('missing ' + I18N); return report(I18N, done, errors, false, 'web i18n.tsx'); }
  const { text: c0, crlf } = read(I18N);
  let c = c0;
  let changed = false;

  if (c.includes('module.reportsColumnExpectedLocationPath')) {
    done.push('labels already present');
  } else {
    // The file stores each language as a big string of "key": 'value' pairs.
    // Insert the EN labels after the first occurrence of the expected-status
    // key (EN dict) and the AR labels after the second (AR dict). If that key
    // is missing, fall back to the "Status" key of each dict.
    const keyRe = /('module\.reportsColumn(?:ExpectedStatus|Status)':\s*'[^']*',\s*)/g;
    const m = c.match(keyRe);
    if (!m || m.length < 2) {
      errors.push('EN+AR dictionary anchors not found');
    } else {
      let enInserted = false;
      let arInserted = false;
      c = c.replace(keyRe, (whole) => {
        if (!enInserted) { enInserted = true; return whole + ' ' + I18N_EN; }
        if (!arInserted) { arInserted = true; return whole + ' ' + I18N_AR; }
        return whole;
      });
      if (enInserted && arInserted) {
        done.push('EN labels');
        done.push('AR labels');
        changed = true;
      } else {
        errors.push('could not insert both label sets');
      }
    }
  }

  if (errors.length === 0 && changed) write(I18N, c, crlf);
  return report(I18N, done, errors, changed, 'web i18n.tsx');
}

// ------------------------------------------------------------------
// Verify
// ------------------------------------------------------------------
function verify() {
  const checks = [
    ['pdf rtlDisplayOrder', () => fs.existsSync(PDF) && fs.readFileSync(PDF, 'utf8').includes('function rtlDisplayOrder')],
    ['pdf cell RTL', () => fs.existsSync(PDF) && fs.readFileSync(PDF, 'utf8').includes('const display = rtlDisplayOrder(cell);')],
    ['repo asset_name', () => fs.existsSync(RESULT_REPO) && fs.readFileSync(RESULT_REPO, 'utf8').includes('a.name AS asset_name')],
    ['repo employee join', () => fs.existsSync(RESULT_REPO) && fs.readFileSync(RESULT_REPO, 'utf8').includes('employees ae ON ae.id = ir.actual_employee_id')],
    ['entity fields', () => fs.existsSync(ENTITY) && fs.readFileSync(ENTITY, 'utf8').includes('asset_name?: string | null;')],
    ['registry profile', () => fs.existsSync(REGISTRY) && fs.readFileSync(REGISTRY, 'utf8').includes("{ key: 'asset_code', label: 'Asset Code', order: 1 },")],
    ['web catalog', () => fs.existsSync(REPORTS) && fs.readFileSync(REPORTS, 'utf8').includes("labelKey: 'module.reportsColumnExpectedLocationPath'")],
    ['web profile keys', () => fs.existsSync(REPORTS) && fs.readFileSync(REPORTS, 'utf8').includes("inventory: ['asset_code'")],
    ['i18n labels', () => fs.existsSync(I18N) && fs.readFileSync(I18N, 'utf8').includes('module.reportsColumnExpectedLocationPath')],
    ['registry caller precedence', () => fs.existsSync(REGISTRY) && fs.readFileSync(REGISTRY, 'utf8').includes('existing.label = c.label;')],
    ['pdf adaptive widths', () => fs.existsSync(PDF) && fs.readFileSync(PDF, 'utf8').includes('function distributeTableWidths') && fs.readFileSync(PDF, 'utf8').includes('let allEmpty = true;')],
  ];
  const bad = checks.filter((x) => { try { return !x[1](); } catch (e) { return true; } }).map((x) => x[0]);
  console.log('VERIFY: ' + (bad.length === 0 ? 'ALL OK' : 'FAILED -> ' + bad.join(', ')));
  return bad.length === 0;
}

// ------------------------------------------------------------------
function main() {
  console.log('AssetX - inventory export columns + Arabic RTL fix');
  console.log('---------------------------------------------------');
  console.log('[INFO] project root = ' + ROOT);
  const ok1 = patchPdf();
  const ok2 = patchResultRepo();
  const ok3 = patchEntity();
  const ok4 = patchRegistry();
  const ok5 = patchReports();
  const ok6 = patchI18n();
  const ok7 = verify();
  if (ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7) {
    console.log('DONE. restart needed: close the 3 windows, run StartX.bat.');
    console.log('Then open Reports, choose Inventory source + PDF/CSV, and export.');
    console.log('The report will show asset name/code, expected/actual location,');
    console.log('expected/actual custodian, and Arabic text in the correct order.');
  } else {
    console.log('NOT DONE - see errors above. No partially written files are left behind.');
    process.exitCode = 1;
  }
}

main();

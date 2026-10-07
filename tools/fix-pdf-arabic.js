#!/usr/bin/env node
/**
 * fix-pdf-arabic.js
 * ------------------------------------------------
 * Makes exported PDF files show Arabic text correctly. Excel/CSV already work;
 * the app's direct PDF export used PDFKit's built-in Helvetica font, which has
 * NO Arabic glyphs, so Arabic appeared as disconnected symbols.
 *
 * What this script does:
 *   1) Downloads the Amiri TrueType Arabic fonts (Regular + Bold) directly from
 *      the npm registry over HTTPS (no npm command needed, so it works even
 *      where spawning npm.cmd fails). Amiri is SIL OFL 1.1 licensed - free.
 *   2) Patches backend/src/infrastructure/export/pdf.generator.ts so PDFs use
 *      the embedded Arabic font (with automatic fallback to Helvetica if the
 *      font files are missing, so the server never breaks).
 *   3) Fixes the table renderer so cells stay on the same row and multi-line
 *      cell text is not cut off.
 *
 * Safe to run more than once (skips files already patched and skips font
 * install when fonts already exist).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execSync } = require('child_process');

// ------------------------------------------------------------------
// Project root detection (same as previous scripts)
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
const BACKEND = ROOT ? path.join(ROOT, 'backend') : null;
const FONT_DIR = BACKEND ? path.join(BACKEND, 'assets', 'fonts') : null;
const REG_FONT = FONT_DIR ? path.join(FONT_DIR, 'Amiri-Regular.ttf') : null;
const BOLD_FONT = FONT_DIR ? path.join(FONT_DIR, 'Amiri-Bold.ttf') : null;
const GENERATOR = BACKEND ? path.join(BACKEND, 'src', 'infrastructure', 'export', 'pdf.generator.ts') : null;

// npm registry tarball for @expo-google-fonts/amiri (ships Amiri TTFs).
const FONT_TARBALL = 'https://registry.npmjs.org/@expo-google-fonts/amiri/-/amiri-0.4.1.tgz';

// ------------------------------------------------------------------
// Direct HTTPS download + minimal TAR extract (no npm subprocess)
// ------------------------------------------------------------------
function fetchUrl(url, maxBytes, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'assetx-fix-pdf-arabic' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchUrl(res.headers.location, maxBytes, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode + ' from ' + url));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > maxBytes) { res.destroy(); reject(new Error('download exceeds size limit')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('download timeout')));
  });
}

function extractTtf(archive) {
  const tar = zlib.gunzipSync(archive);
  const found = { reg: null, bold: null };
  let off = 0;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/[\0 ]/g, '');
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const typeflag = String.fromCharCode(header[156]);
    off += 512;
    const body = tar.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if ((typeflag === '0' || typeflag === '\0') && size > 0) {
      if (name.endsWith('400Regular/Amiri_400Regular.ttf')) found.reg = Buffer.from(body);
      else if (name.endsWith('700Bold/Amiri_700Bold.ttf')) found.bold = Buffer.from(body);
    }
  }
  return found;
}

async function installFonts() {
  if (REG_FONT && BOLD_FONT && fs.existsSync(REG_FONT) && fs.existsSync(BOLD_FONT)) {
    console.log('[OK] fonts => already installed (SKIP)');
    return true;
  }
  console.log('[INFO] downloading Amiri Arabic fonts from the npm registry (one-time)...');
  try {
    const tgz = await fetchUrl(FONT_TARBALL, 8 * 1024 * 1024, 5);
    const f = extractTtf(tgz);
    if (!f.reg || !f.bold) throw new Error('font files not found inside the archive');
    if (f.reg.readUInt32BE(0) !== 0x00010000 || f.bold.readUInt32BE(0) !== 0x00010000) {
      throw new Error('downloaded files are not TrueType fonts');
    }
    fs.mkdirSync(FONT_DIR, { recursive: true });
    fs.writeFileSync(REG_FONT, f.reg);
    fs.writeFileSync(BOLD_FONT, f.bold);
    console.log('[OK] fonts => installed to ' + path.relative(ROOT, FONT_DIR));
    return fs.existsSync(REG_FONT) && fs.existsSync(BOLD_FONT);
  } catch (e) {
    console.log('[WARN] direct download failed (' + (e && e.message ? e.message : e) + ').');
    console.log('[INFO] trying npm as fallback...');
    return installViaNpm();
  }
}

// Fallback: npm install in a temp dir (execSync uses the OS shell, which
// handles npm.cmd on Windows correctly - unlike spawnSync).
function installViaNpm() {
  const tmp = path.join(require('os').tmpdir(), 'ax-font-install-' + Date.now());
  try {
    fs.mkdirSync(tmp, { recursive: true });
    execSync('npm install --no-audit --no-fund --silent @expo-google-fonts/amiri', { cwd: tmp, stdio: 'pipe' });
    const src = path.join(tmp, 'node_modules', '@expo-google-fonts', 'amiri');
    const reg = path.join(src, '400Regular', 'Amiri_400Regular.ttf');
    const bold = path.join(src, '700Bold', 'Amiri_700Bold.ttf');
    if (!fs.existsSync(reg) || !fs.existsSync(bold)) throw new Error('downloaded package structure unexpected');
    fs.mkdirSync(FONT_DIR, { recursive: true });
    fs.copyFileSync(reg, REG_FONT);
    fs.copyFileSync(bold, BOLD_FONT);
    console.log('[OK] fonts => installed via npm to ' + path.relative(ROOT, FONT_DIR));
    return fs.existsSync(REG_FONT) && fs.existsSync(BOLD_FONT);
  } catch (e) {
    console.log('[ERROR] font install failed: ' + (e && e.message ? e.message : e));
    console.log('        Make sure this machine has internet access to registry.npmjs.org.');
    return false;
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

// ------------------------------------------------------------------
// Patch pdf.generator.ts
// ------------------------------------------------------------------
const IMPORT_ANCHOR = "import PDFKit = require('pdfkit');";
const IMPORTS_ADD = "import * as fs from 'fs';\nimport * as path from 'path';\n" + IMPORT_ANCHOR;

const FONTS_ANCHOR = "const PAGE_DIMS: Record<string, [number, number]> = {\n  A4: [595.28, 841.89], A3: [841.89, 1190.55], LETTER: [612, 792], LEGAL: [612, 1008],\n};";
const FONTS_ADD = FONTS_ANCHOR + "\n\n/** Embedded Arabic fonts (Amiri, SIL Open Font License 1.1) so exported PDFs\n *  render Arabic text correctly. PDFKit's built-in Helvetica has no Arabic\n *  glyphs. Files live under backend/assets/fonts (installed by the fix script). */\nconst ARABIC_FONT = path.resolve(__dirname, '../../../assets/fonts/Amiri-Regular.ttf');\nconst ARABIC_FONT_BOLD = path.resolve(__dirname, '../../../assets/fonts/Amiri-Bold.ttf');\nconst FONT_ARABIC = 'AssetXArabic';\nconst FONT_ARABIC_BOLD = 'AssetXArabicBold';\n\nfunction arabicFontsAvailable(): boolean {\n  return fs.existsSync(ARABIC_FONT) && fs.existsSync(ARABIC_FONT_BOLD);\n}";

const DOC_ANCHOR = "    const doc = new PDFKit({ margin: 0, size: [dims[0], dims[1]], margins });\n    const chunks: Buffer[] = [];\n    doc.on('data', (c: Buffer) => chunks.push(c));";
const DOC_ADD = DOC_ANCHOR + "\n\n    // Use the embedded Arabic font when available (Arabic + Latin coverage).\n    if (arabicFontsAvailable()) {\n      doc.registerFont(FONT_ARABIC, ARABIC_FONT);\n      doc.registerFont(FONT_ARABIC_BOLD, ARABIC_FONT_BOLD);\n      doc.font(FONT_ARABIC);\n    } else {\n      doc.font('Helvetica');\n    }";

const OLD_DRAW = "      cells.forEach((cell, i) => {\n        const x = left + i * colWidth;\n        const fg = isHeader ? (colors.headerFg ?? '#ffffff') : (colors.title ?? '#111827');\n        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(typo.tableSize ?? 8)\n          .fillColor(fg).text(this.truncate(cell, colWidth), x + 4, doc.y + 4, { width: colWidth - 8, ellipsis: true });\n      });\n      doc.moveDown(rowHeight / 2);";

const NEW_DRAW = "      cells.forEach((cell, i) => {\n        const x = left + i * colWidth;\n        const fg = isHeader ? (colors.headerFg ?? '#ffffff') : (colors.title ?? '#111827');\n        const fontName = isHeader\n          ? (arabicFontsAvailable() ? FONT_ARABIC_BOLD : 'Helvetica-Bold')\n          : (arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica');\n        // Row height grows when a cell needs more than one line (heightOfString\n        // returns a height in points, so it can be used directly).\n        if (!isHeader) {\n          const usedHeight = doc.font(fontName).fontSize(typo.tableSize ?? 8).heightOfString(cell, { width: colWidth - 8 }) + 4;\n          rowHeightCur = Math.max(rowHeightCur, usedHeight);\n        }\n        doc.font(fontName).fontSize(typo.tableSize ?? 8)\n          .fillColor(fg).text(cell, x + 4, rowTop + 4, { width: colWidth - 8 });\n      });\n      // Set doc.y directly (moveDown() counts in lines, not points, which\n      // caused huge gaps between rows).\n      doc.y = rowTop + rowHeightCur + 2;";

// Original (pre-fix) drawRow head - no rowTop present.
const OLD_DRAW_HEAD = "    const drawRow = (cells: string[], isHeader: boolean, rowIndex: number) => {\n      if (doc.y + rowHeight > doc.page.height - 50) doc.addPage();\n      const bg = ";
const NEW_DRAW_HEAD = "    const drawRow = (cells: string[], isHeader: boolean, rowIndex: number) => {\n      let rowHeightCur = rowHeight;\n      if (doc.y + rowHeightCur > doc.page.height - 50) doc.addPage();\n      const rowTop = doc.y;\n      const bg = ";

// Row background rect must use rowTop + rowHeightCur too.
const OLD_RECT = "      doc.rect(left, doc.y, contentWidth, rowHeight).fill(bg);";
const NEW_RECT = "      doc.rect(left, rowTop, contentWidth, rowHeightCur).fill(bg);";

const OLD_TITLE = "    doc.fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(title, { align: 'center' });\n    doc.moveDown(0.2);\n    if (h?.showGeneratedAt) {\n      doc.fontSize(typo.bodySize ?? 9).fillColor(colors.subtitle ?? '#6b7280')\n        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });\n    }";
const NEW_TITLE = "    const titleFont = arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica';\n    doc.font(titleFont).fontSize(typo.titleSize ?? 18).fillColor(colors.title ?? '#1f2937').text(title, { align: 'center' });\n    doc.moveDown(0.2);\n    if (h?.showGeneratedAt) {\n      doc.font(titleFont).fontSize(typo.bodySize ?? 9).fillColor(colors.subtitle ?? '#6b7280')\n        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });\n    }";

const OLD_FOOTER = "      doc.fontSize(typo.footerSize ?? 8).fillColor(colors.subtitle ?? '#9ca3af')\n        .text(text, 0, doc.page.height - 20, { align: 'center', width: pageWidth });";
const NEW_FOOTER = "      doc.font(arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica')\n        .fontSize(typo.footerSize ?? 8).fillColor(colors.subtitle ?? '#9ca3af')\n        .text(text, 0, doc.page.height - 20, { align: 'center', width: pageWidth });";

function patchGenerator() {
  const errors = [];
  const done = [];
  if (!GENERATOR || !fs.existsSync(GENERATOR)) { console.log('[ERROR] missing: ' + (GENERATOR || 'project root not detected')); return false; }
  const raw = fs.readFileSync(GENERATOR, 'utf8');
  const crlf = /\r\n/.test(raw);
  let c = raw.replace(/\r\n/g, '\n');
  let changed = false;

  // 1) imports
  if (c.includes("import * as fs from 'fs'")) {
    done.push('fs/path imports already present');
  } else if (!c.includes(IMPORT_ANCHOR)) {
    errors.push('import anchor not found (unexpected pdf.generator.ts layout)');
  } else {
    c = c.replace(IMPORT_ANCHOR, IMPORTS_ADD);
    done.push('fs/path imports');
    changed = true;
  }

  if (errors.length === 0) {
    // 2) font constants + helper
    if (c.includes('const ARABIC_FONT')) {
      done.push('font constants already present');
    } else if (!c.includes(FONTS_ANCHOR)) {
      errors.push('PAGE_DIMS anchor not found');
    } else {
      c = c.replace(FONTS_ANCHOR, FONTS_ADD);
      done.push('font constants + arabicFontsAvailable()');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 3) register fonts + default font in generate()
    if (c.includes('doc.registerFont(FONT_ARABIC')) {
      done.push('font registration already present');
    } else if (!c.includes(DOC_ANCHOR)) {
      errors.push('doc anchor not found');
    } else {
      c = c.replace(DOC_ANCHOR, DOC_ADD);
      done.push('font registration');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 4) drawRow head (rowHeightCur + rowTop)
    if (c.includes('let rowHeightCur = rowHeight;')) {
      done.push('rowHeightCur already present');
    } else if (!c.includes(OLD_DRAW_HEAD)) {
      errors.push('drawRow head not found');
    } else {
      c = c.replace(OLD_DRAW_HEAD, NEW_DRAW_HEAD);
      done.push('drawRow height fix');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 4b) row background rect uses rowTop + rowHeightCur
    if (c.includes('doc.rect(left, rowTop, contentWidth, rowHeightCur).fill(bg);')) {
      done.push('row rect already fixed');
    } else if (!c.includes(OLD_RECT)) {
      errors.push('row rect line not found');
    } else {
      c = c.replace(OLD_RECT, NEW_RECT);
      done.push('row rect baseline fix');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 5) drawRow cells (Arabic font + no ellipsis + same baseline)
    if (c.includes('const fontName = isHeader')) {
      done.push('Arabic cell font already present');
    } else if (!c.includes(OLD_DRAW)) {
      errors.push('drawRow body not found');
    } else {
      c = c.replace(OLD_DRAW, NEW_DRAW);
      done.push('Arabic cell font + multiline rows');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 6) header title font
    if (c.includes('const titleFont = arabicFontsAvailable')) {
      done.push('header title font already present');
    } else if (!c.includes(OLD_TITLE)) {
      errors.push('header title block not found');
    } else {
      c = c.replace(OLD_TITLE, NEW_TITLE);
      done.push('header title font');
      changed = true;
    }
  }

  if (errors.length === 0) {
    // 7) footer font
    if (c.includes("doc.font(arabicFontsAvailable() ? FONT_ARABIC : 'Helvetica')")) {
      done.push('footer font already present');
    } else if (!c.includes(OLD_FOOTER)) {
      errors.push('footer block not found');
    } else {
      c = c.replace(OLD_FOOTER, NEW_FOOTER);
      done.push('footer font');
      changed = true;
    }
  }

  if (errors.length === 0 && changed) {
    fs.writeFileSync(GENERATOR, crlf ? c.replace(/\n/g, '\r\n') : c, 'utf8');
  }
  const state = errors.length === 0
    ? (changed ? 'PATCHED (' + done.join(', ') + ')' : 'already fixed (nothing to change)')
    : 'NOT patched';
  console.log((errors.length === 0 ? '[OK] ' : '[ERROR] ') + path.relative(ROOT, GENERATOR) + ' => ' + state);
  for (const e of errors) console.log('        ' + e);
  return errors.length === 0;
}

function verify() {
  const checks = [];
  try {
    const g = fs.readFileSync(GENERATOR, 'utf8');
    checks.push(['generator imports fs/path', g.includes("import * as fs from 'fs'")]);
    checks.push(['generator ARABIC_FONT', g.includes('const ARABIC_FONT')]);
    checks.push(['generator arabicFontsAvailable()', g.includes('function arabicFontsAvailable')]);
    checks.push(['generator registerFont', g.includes('doc.registerFont(FONT_ARABIC')]);
    checks.push(['generator cell font', g.includes('const fontName = isHeader')]);
    checks.push(['generator no ellipsis truncate in cells', !g.includes('this.truncate(cell, colWidth)')]);
  } catch (e) { checks.push(['generator readable', false]); }
  checks.push(['font regular exists', !!(REG_FONT && fs.existsSync(REG_FONT))]);
  checks.push(['font bold exists', !!(BOLD_FONT && fs.existsSync(BOLD_FONT))]);
  const bad = checks.filter((x) => !x[1]).map((x) => x[0]);
  console.log('VERIFY: ' + (bad.length === 0 ? 'ALL OK' : 'FAILED -> ' + bad.join(', ')));
  return bad.length === 0;
}

async function main() {
  console.log('AssetX - Arabic PDF font fix');
  console.log('----------------------------');
  if (!ROOT || !FONT_DIR) {
    console.log('[ERROR] project folder not found.');
    console.log('        Make sure this script is saved inside the assetx-enterprise-platform-v2 folder.');
    process.exitCode = 1;
    return;
  }
  console.log('[INFO] project root = ' + ROOT);
  const ok1 = await installFonts();
  const ok2 = patchGenerator();
  const ok3 = verify();
  if (ok1 && ok2 && ok3) {
    console.log('DONE. restarted backend needed: close the 3 windows, run StartX.bat,');
    console.log('then export as PDF (format=pdf) and open it - Arabic should render correctly.');
  } else {
    console.log('NOT DONE - see errors above. No partially written files are left behind.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('UNEXPECTED ERROR:', e && e.message ? e.message : e);
  process.exitCode = 1;
});

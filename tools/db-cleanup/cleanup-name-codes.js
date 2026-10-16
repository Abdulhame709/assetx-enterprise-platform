/**
 * AssetX — cleanup: "one clean name = one base code" for EXISTING data.
 *
 * What it does (per tenant, all in ONE transaction):
 *   1. Groups assets by clean name (same folding the system uses on create:
 *      spaces, hamza/alef, ya/alef-maqsura, ta-marbuta/ha, diacritics and a legacy
 *      "(2025-0038-13@...)" suffix are ignored).
 *   2. Every record of a name adopts ONE base code — the oldest (lowest) one.
 *      The internal full code is regenerated so it stays unique.
 *   3. A legacy "(code)" suffix is removed from the name and the old code is kept
 *      in its own column  assets.legacy_code  ("الكود القديم") — NOT in the notes —
 *      so it takes no space in reports unless that column is chosen.
 *      Needs migration 016_asset_legacy_code.sql to be applied first.
 *   4. ONLY records that are identical in name, location, type, sub-type, model,
 *      status, holder, notes, legacy code, price, serial and barcode AND have no movements /
 *      inventory / maintenance history are merged: quantities are added to the
 *      oldest record and the other one is deactivated (soft delete).
 *      Records that differ in anything above stay separate. Identical records
 *      that have history are listed and left alone.
 *   5. Optional  --unify-spelling : spelling variants of one name (e.g. "ابو" /
 *      "أبو", "سله" / "سلة") are rewritten to the most frequent spelling.
 *
 * Safety:
 *   - DEFAULT IS A DRY RUN: it executes every change, verifies, then ROLLS BACK.
 *   - --apply  asks for a typed confirmation, writes a JSON backup of the tenant's
 *     assets and a backup TABLE inside the database, then commits only if all
 *     verification checks pass (counts, quantities, one code per name, no codes
 *     left in names). Any failure rolls everything back.
 *   - --restore <backup_table | backup.json>  puts name / codes / notes / legacy code / quantity /
 *     active flag back from a backup table created by --apply.
 *
 * Usage (from the project root):
 *   node tools/db-cleanup/cleanup-name-codes.js                    dry run
 *   node tools/db-cleanup/cleanup-name-codes.js --unify-spelling   dry run incl. spelling
 *   node tools/db-cleanup/cleanup-name-codes.js --apply [--unify-spelling]
 *   node tools/db-cleanup/cleanup-name-codes.js --restore assets_backup_YYYYMMDD_HHMMSS_<tenant>
 *   node tools/db-cleanup/cleanup-name-codes.js --restore tools/db-cleanup/out/backup-assets-....json
 *
 * Output: console summary + tools/db-cleanup/out/cleanup-plan-<tenant>.csv
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = path.resolve(__dirname, '..', '..');

// ───────────────────────── pure helpers (unit-tested) ─────────────────────────

const INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN = '۰۱۲۳۴۵۶۷۸۹';
/** Same rules as foldAssetName() in backend/src/application/asset-algorithms.ts. */
function fold(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN.indexOf(d)))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// Trailing "( ... 2025-0038 ... )" left by the old importer.
const CODED_SUFFIX = /\s*\(([^()]*\b\d{4}-\d{1,6}[^()]*)\)\s*$/;
const cleanName = (name) => String(name || '').replace(CODED_SUFFIX, '').trim();
const legacyCodeOf = (name) => {
  const m = String(name || '').match(CODED_SUFFIX);
  return m ? m[1].trim() : null;
};
const spaced = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Mirrors cleanLocationName()/generateFullAssetCode() in asset-algorithms.ts. */
function cleanLocationName(locationName) {
  const cleaned = String(locationName ?? '')
    .trim()
    .normalize('NFKC')
    .replace(/[\s_–—/\\,.;:|]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.toLowerCase() || 'location';
}
function generateFullCode(baseCode, locationPath, used) {
  const rootCode = `${baseCode}@${cleanLocationName(locationPath || 'location')}`;
  if (!used.has(rootCode)) return rootCode;
  for (let i = 1; i <= 1000; i += 1) {
    const candidate = `${rootCode}-${String(i).padStart(2, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('FULL_CODE_GENERATION_EXHAUSTED');
}

const keyOf = (v) => (v === null || v === undefined ? '' : String(v));
/** Identity of a record: everything that must match for two records to be merged. */
function identitySignature(a) {
  return [
    fold(cleanName(a.name)), keyOf(a.location_id), keyOf(a.category_id), keyOf(a.sub_type_id), keyOf(a.model_id),
    keyOf(a.status_id), keyOf(a.employee_id), fold(a.notes), fold(a.legacy_code), Number(a.purchase_price || 0),
    keyOf(a.serial_number).trim(), keyOf(a.barcode).trim(),
  ].join('|');
}
const byOldest = (x, y) => new Date(x.created_at) - new Date(y.created_at) || String(x.id).localeCompare(String(y.id));

/**
 * Pure planner. rows = ALL assets of one tenant (active and inactive).
 * usedFullCodes = every full_asset_code in the database (only ever grows, so no
 * UPDATE can collide with another UPDATE of the same run).
 * refIds = ids of assets that have movements / inventory / maintenance history.
 * Returns Map id -> { before, after, actions[] } for records that change.
 */
function planCleanup(rows, usedFullCodes, refIds, opts = {}) {
  const used = new Set(usedFullCodes);
  const changes = new Map();
  const stats = {
    records: rows.length, names: 0, multiCode: 0, recoded: 0, namesCleaned: 0, spellingUnified: 0,
    merged: 0, mergeSkippedHistory: 0, inactiveIncluded: rows.filter((r) => !r.is_active).length,
  };
  const skipped = [];
  const change = (r) => {
    if (!changes.has(r.id)) {
      changes.set(r.id, {
        before: r,
        after: { name: r.name, base_asset_code: r.base_asset_code, full_asset_code: r.full_asset_code, notes: r.notes ?? null, legacy_code: r.legacy_code ?? null, quantity: Number(r.quantity), is_active: r.is_active },
        actions: [],
      });
    }
    return changes.get(r.id);
  };
  // The old code goes to its own column (several codes are joined, never overwritten).
  const addLegacy = (r, code) => {
    const c = change(r);
    if (String(c.after.legacy_code || '').split(' — ').includes(code)) return;
    c.after.legacy_code = [c.after.legacy_code, code].filter(Boolean).join(' — ');
    if (!c.actions.includes('legacy')) c.actions.push('legacy');
  };

  const groups = new Map();
  for (const r of rows) {
    const key = fold(cleanName(r.name));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  stats.names = groups.size;

  for (const g of groups.values()) {
    const codes = [...new Set(g.map((r) => r.base_asset_code))].sort();
    const keep = codes[0];
    if (codes.length > 1) stats.multiCode += 1;

    // 1) merge fully identical ACTIVE records (no history), oldest wins
    const gone = new Set();
    const clusters = new Map();
    for (const r of g.filter((x) => x.is_active)) {
      const k = identitySignature(r);
      if (!clusters.has(k)) clusters.set(k, []);
      clusters.get(k).push(r);
    }
    for (const cluster of clusters.values()) {
      if (cluster.length < 2) continue;
      const [keeper, ...others] = cluster.slice().sort(byOldest);
      for (const dup of others) {
        if (refIds.has(dup.id)) {
          stats.mergeSkippedHistory += 1;
          skipped.push({ keeper, dup });
          continue;
        }
        const kc = change(keeper);
        kc.after.quantity += Number(dup.quantity);
        if (!kc.actions.includes('merge-target')) kc.actions.push('merge-target');
        const dc = change(dup);
        dc.after.is_active = false;
        dc.actions.push('merged-away');
        gone.add(dup.id);
        stats.merged += 1;
        const legacy = legacyCodeOf(dup.name);
        if (legacy) addLegacy(keeper, legacy);
      }
    }

    // 2) names: strip legacy code (kept in legacy_code), optionally unify spelling
    let target = null;
    if (opts.unifySpelling) {
      const pool = (g.some((x) => x.is_active) ? g.filter((x) => x.is_active) : g).map((x) => spaced(cleanName(x.name)));
      const freq = new Map();
      for (const n of pool) freq.set(n, (freq.get(n) || 0) + 1);
      target = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0][0];
    }
    for (const r of g) {
      const wanted = target !== null ? target : cleanName(r.name);
      if (wanted === r.name) continue;
      const c = change(r);
      c.after.name = wanted;
      const legacy = legacyCodeOf(r.name);
      if (legacy) {
        stats.namesCleaned += 1;
        c.actions.push('name-cleaned');
        if (!gone.has(r.id)) addLegacy(r, legacy);
      } else {
        stats.spellingUnified += 1;
        c.actions.push('spelling');
      }
    }

    // 3) one base code per name; regenerate the (internal, unique) full code
    for (const r of g) {
      if (r.base_asset_code === keep) continue;
      const c = change(r);
      c.after.base_asset_code = keep;
      c.after.full_asset_code = generateFullCode(keep, r.location_path, used);
      used.add(c.after.full_asset_code);
      c.actions.push('recoded');
      stats.recoded += 1;
    }
  }
  return { changes, stats, skipped };
}

// ───────────────────────────── database side ─────────────────────────────

const ASSETS_SQL = `
  SELECT a.id, a.tenant_id, a.name, a.base_asset_code, a.full_asset_code, a.notes, a.legacy_code, a.quantity, a.is_active, a.created_at,
         a.location_id, a.category_id, a.sub_type_id, a.model_id, a.status_id, a.employee_id,
         a.purchase_price, a.serial_number, a.barcode, l.full_path AS location_path
  FROM assets a
  LEFT JOIN locations l ON l.id = a.location_id
  WHERE a.tenant_id = $1
  ORDER BY a.created_at, a.id`;

async function findReferencingColumns(client) {
  const { rows } = await client.query(`
    SELECT c.conrelid::regclass::text AS tbl, att.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'assets'::regclass AND array_length(c.conkey, 1) = 1`);
  return rows;
}

async function idsWithHistory(client, refCols, ids) {
  const out = new Set();
  if (!ids.length) return out;
  for (const { tbl, col } of refCols) {
    const q = `SELECT DISTINCT "${col}" AS id FROM ${tbl} WHERE "${col}" = ANY($1::uuid[])`;
    for (const r of (await client.query(q, [ids])).rows) out.add(String(r.id));
  }
  return out;
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const ACTION_AR = {
  recoded: 'توحيد الكود', 'name-cleaned': 'حذف الكود من الاسم', spelling: 'توحيد الإملاء',
  legacy: 'نقل الكود القديم إلى عمود «الكود القديم»', 'merge-target': 'استلم كمية مدموجة', 'merged-away': 'دُمج وتم تعطيله',
};

function verify(before, after, plan, label) {
  const problems = [];
  const sum = (rows) => rows.filter((r) => r.is_active).reduce((n, r) => n + Number(r.quantity), 0);
  const activeBefore = before.filter((r) => r.is_active).length;
  const activeAfter = after.filter((r) => r.is_active).length;
  if (activeAfter !== activeBefore - plan.stats.merged) problems.push(`عدد الأصول النشطة غير متوقع: ${activeBefore} → ${activeAfter} (دمج ${plan.stats.merged})`);
  if (sum(after) !== sum(before)) problems.push(`مجموع الكميات تغيّر: ${sum(before)} → ${sum(after)}`);
  if (after.length !== before.length) problems.push(`عدد السجلات تغيّر: ${before.length} → ${after.length}`);
  const codesByName = new Map();
  for (const r of after) {
    const k = fold(cleanName(r.name));
    if (!k) continue;
    if (!codesByName.has(k)) codesByName.set(k, new Set());
    codesByName.get(k).add(r.base_asset_code);
  }
  const multi = [...codesByName.values()].filter((s) => s.size > 1).length;
  if (multi) problems.push(`بقي ${multi} اسماً بأكثر من كود`);
  const coded = after.filter((r) => CODED_SUFFIX.test(String(r.name))).length;
  if (coded) problems.push(`بقي ${coded} سجلاً فيه كود داخل الاسم`);
  // no old code may be lost: every code removed from a name must now sit in a legacy_code column
  const kept = new Set(after.flatMap((r) => String(r.legacy_code || '').split(' — ')).filter(Boolean));
  const lost = before.map((r) => legacyCodeOf(r.name)).filter((code) => code && !kept.has(code)).length;
  if (lost) problems.push(`فُقد ${lost} كوداً قديماً`);
  if (problems.length) throw new Error(`فشل التحقق (${label}): ${problems.join(' | ')}`);
}

/** The legacy code has its own column (migration 016); stop with a clear message if it is missing. */
async function requireLegacyColumn(client) {
  const { rows } = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'legacy_code' LIMIT 1",
  );
  if (!rows.length) {
    throw new Error('عمود «الكود القديم» (legacy_code) غير موجود في قاعدة البيانات. طبّق الترحيل db/migrations/016_asset_legacy_code.sql أولاً (scripts/db-add-legacy-code.ps1) ثم أعد التشغيل.');
  }
}

/**
 * Runs the cleanup for ONE tenant inside a transaction.
 * `client` only needs .query(sql, params). Returns the summary; throws on failure
 * (after rolling back).
 */
async function runTenant(client, tenant, opts, io = {}) {
  const log = io.log || (() => {});
  await requireLegacyColumn(client);
  await client.query('BEGIN');
  try {
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenant.id]);
    const before = (await client.query(ASSETS_SQL, [tenant.id])).rows;
    const usedFull = (await client.query('SELECT full_asset_code FROM assets')).rows.map((r) => r.full_asset_code);
    const refCols = await findReferencingColumns(client);
    const activeIds = before.filter((r) => r.is_active).map((r) => r.id);
    const refIds = await idsWithHistory(client, refCols, activeIds);

    const plan = planCleanup(before, usedFull, refIds, opts);

    if (opts.apply) {
      const safe = String(tenant.tenant_code).toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})(\d{6})$/, '$1_$2');
      const backupTable = `assets_backup_${stamp}_${safe}`;
      if (io.writeBackupFile) io.writeBackupFile(`backup-assets-${stamp}-${safe}.json`, before);
      // The JSON file above is the guaranteed backup; the table copy is a bonus
      // (a restricted database user may not be allowed to create tables).
      await client.query('SAVEPOINT backup_table');
      try {
        await client.query(`CREATE TABLE "${backupTable}" AS SELECT * FROM assets WHERE tenant_id = $1`, [tenant.id]);
        await client.query('RELEASE SAVEPOINT backup_table');
        plan.backupTable = backupTable;
        log(`  نسخة احتياطية داخل قاعدة البيانات: ${backupTable}`);
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT backup_table');
        log('  تنبيه: تعذّر إنشاء جدول نسخة احتياطية (صلاحيات)، والاعتماد على ملف JSON فقط.');
      }
    }

    // The unique full code can only collide with codes that already existed; to be
    // safe against ordering, move changing rows to temporary codes first.
    const recoded = [...plan.changes.values()].filter((c) => c.after.full_asset_code !== c.before.full_asset_code);
    for (const c of recoded) {
      await client.query('UPDATE assets SET full_asset_code = $2 WHERE id = $1', [c.before.id, `tmp-${c.before.id}`]);
    }
    for (const c of plan.changes.values()) {
      const a = c.after;
      await client.query(
        `UPDATE assets SET name = $2, base_asset_code = $3, full_asset_code = $4, notes = $5, legacy_code = $6, quantity = $7, is_active = $8
         WHERE id = $1 AND tenant_id = $9`,
        [c.before.id, a.name, a.base_asset_code, a.full_asset_code, a.notes, a.legacy_code, a.quantity, a.is_active, tenant.id],
      );
    }

    const after = (await client.query(ASSETS_SQL, [tenant.id])).rows;
    verify(before, after, plan, tenant.tenant_code);

    if (opts.apply) await client.query('COMMIT');
    else await client.query('ROLLBACK');
    return plan;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already closed */ }
    throw err;
  }
}

/**
 * Puts name / codes / notes / quantity / active flag back from backup rows
 * (read from a backup table or from the JSON file written by --apply).
 */
async function restoreRows(client, rows) {
  const byTenant = new Map();
  for (const r of rows) {
    if (!byTenant.has(r.tenant_id)) byTenant.set(r.tenant_id, []);
    byTenant.get(r.tenant_id).push(r);
  }
  let restored = 0;
  for (const [tid, list] of byTenant) {
    await client.query('BEGIN');
    try {
      await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tid]);
      // park full codes first so restoring them one by one can never collide
      for (const r of list) {
        await client.query('UPDATE assets SET full_asset_code = $2 WHERE id = $1 AND full_asset_code <> $3', [r.id, `restore-${r.id}`, r.full_asset_code]);
      }
      for (const r of list) {
        await client.query(
          `UPDATE assets SET name = $2, base_asset_code = $3, full_asset_code = $4, notes = $5, legacy_code = $6, quantity = $7, is_active = $8
           WHERE id = $1 AND tenant_id = $9`,
          [r.id, r.name, r.base_asset_code, r.full_asset_code, r.notes, r.legacy_code ?? null, r.quantity, r.is_active, tid],
        );
        restored += 1;
      }
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }
  return restored;
}

async function restoreTenant(client, backupTable) {
  if (!/^assets_backup_[a-z0-9_]+$/.test(backupTable)) throw new Error('اسم جدول النسخة الاحتياطية غير صالح');
  const rows = (await client.query(`SELECT * FROM "${backupTable}"`)).rows;
  return restoreRows(client, rows);
}

// ───────────────────────────────── CLI ─────────────────────────────────

function loadEnv() {
  const env = {};
  const envPath = path.join(root, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
  return env;
}

const ask = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

function writePlanCsv(outDir, tenant, plan) {
  const rows = [['الإجراءات', 'الاسم قبل', 'الاسم بعد', 'الكود قبل', 'الكود بعد', 'الكمية قبل', 'الكمية بعد', 'نشط قبل', 'نشط بعد', 'الموقع', 'الملاحظات بعد', 'الكود القديم بعد']];
  for (const c of plan.changes.values()) {
    rows.push([
      c.actions.map((a) => ACTION_AR[a] || a).join(' + '), c.before.name, c.after.name, c.before.base_asset_code, c.after.base_asset_code,
      c.before.quantity, c.after.quantity, c.before.is_active ? 'نعم' : 'لا', c.after.is_active ? 'نعم' : 'لا',
      c.before.location_path || '', c.after.notes || '', c.after.legacy_code || '',
    ]);
  }
  for (const s of plan.skipped) {
    rows.push(['متطابق لكن له سجل حركات/جرد/صيانة — لم يُدمج', s.dup.name, '', s.dup.base_asset_code, s.keeper.base_asset_code, s.dup.quantity, '', 'نعم', 'نعم', s.dup.location_path || '', '', '']);
  }
  const file = path.join(outDir, `cleanup-plan-${String(tenant.tenant_code).replace(/[^a-zA-Z0-9_-]+/g, '_')}.csv`);
  fs.writeFileSync(file, '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { apply: args.includes('--apply'), unifySpelling: args.includes('--unify-spelling') };
  const restoreIdx = args.indexOf('--restore');
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    console.log('لا يوجد DATABASE_URL في backend/.env — لا توجد قاعدة محلية.');
    return;
  }
  const pg = require(path.join(root, 'backend', 'node_modules', 'pg'));
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    console.log('تعذر الاتصال بقاعدة البيانات:', String(err.message || err));
    process.exitCode = 1;
    return;
  }

  try {
    if (restoreIdx !== -1) {
      const table = args[restoreIdx + 1] || '';
      const answer = await ask(`سيتم إرجاع الأسماء والأكواد والكود القديم والملاحظات والكميات من النسخة (جدول أو ملف JSON) "${table}". اكتب YES للمتابعة: `);
      if (answer !== 'YES') { console.log('أُلغي — لم يتغيّر شيء.'); return; }
      const n = table.toLowerCase().endsWith('.json')
        ? await restoreRows(client, JSON.parse(fs.readFileSync(table, 'utf8')))
        : await restoreTenant(client, table);
      console.log(`تمت الاستعادة: ${n} سجلاً.`);
      return;
    }

    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const tenants = (await client.query('SELECT id, tenant_code, name FROM tenants ORDER BY tenant_code')).rows;

    console.log(opts.apply ? '*** وضع التنفيذ الفعلي ***' : '*** تجربة فقط: تُنفَّذ التغييرات ثم تُلغى بالكامل ***');
    if (opts.apply) {
      console.log('تأكد أنك أوقفت التطبيق (الخادم) قبل التنفيذ حتى لا يعدّل أحد البيانات أثناء التنظيف.');
      const answer = await ask('اكتب YES لتنفيذ التنظيف على قاعدة البيانات: ');
      if (answer !== 'YES') { console.log('أُلغي — لم يتغيّر شيء.'); return; }
    }

    for (const tenant of tenants) {
      console.log('═'.repeat(60));
      console.log(`المستأجر: ${tenant.tenant_code} (${tenant.name})`);
      const plan = await runTenant(client, tenant, opts, {
        log: (m) => console.log(m),
        writeBackupFile: (name, rows) => {
          const f = path.join(outDir, name);
          fs.writeFileSync(f, JSON.stringify(rows, null, 2), 'utf8');
          console.log(`  نسخة احتياطية (ملف): ${f}`);
        },
      });
      const s = plan.stats;
      console.log(`  السجلات: ${s.records} (منها غير نشطة: ${s.inactiveIncluded}) — أسماء نظيفة: ${s.names}`);
      console.log(`  أسماء كانت بأكثر من كود: ${s.multiCode} — سجلات سيُوحَّد كودها: ${s.recoded}`);
      console.log(`  أسماء سيُحذف منها الكود القديم (ويُحفظ في عمود «الكود القديم»): ${s.namesCleaned}`);
      console.log(`  سجلات متطابقة تماماً ستُدمج (تُجمع كمياتها): ${s.merged}`);
      console.log(`  متطابقة لكن لها حركات/جرد/صيانة فلن تُدمج: ${s.mergeSkippedHistory}`);
      console.log(opts.unifySpelling
        ? `  أسماء ستُوحَّد إملائياً: ${s.spellingUnified}`
        : '  توحيد الإملاء غير مفعّل (أضف --unify-spelling لتفعيله)');
      console.log('  التحقق بعد التعديل: ناجح (عدد الأصول، الكميات، كود واحد لكل اسم)');
      console.log(`  ملف الخطة (افتحه في Excel): ${writePlanCsv(outDir, tenant, plan)}`);
      if (plan.backupTable) console.log(`  للتراجع لاحقاً: node tools/db-cleanup/cleanup-name-codes.js --restore ${plan.backupTable}`);
      else if (opts.apply) console.log('  للتراجع لاحقاً: node tools/db-cleanup/cleanup-name-codes.js --restore <ملف JSON أعلاه>');
    }
    console.log('═'.repeat(60));
    console.log(opts.apply ? 'تم التنفيذ وحُفظت التغييرات.' : 'انتهت التجربة — لم يُحفظ أي تعديل.');
  } catch (err) {
    console.log('توقف التنفيذ وتم التراجع عن كل التغييرات:', String(err && err.message));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

module.exports = { requireLegacyColumn, restoreRows, fold, cleanName, legacyCodeOf, cleanLocationName, generateFullCode, identitySignature, planCleanup, runTenant, restoreTenant, verify };

if (require.main === module) {
  main().catch((err) => {
    console.log('خطأ:', String(err && err.message));
    process.exitCode = 1;
  });
}

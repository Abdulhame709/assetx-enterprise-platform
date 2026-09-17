'use strict';
/**
 * AssetX legacy migration — step 2.
 * Reads the old AssetX SQL Server database (AssetsDB) with sqlcmd and writes five
 * Excel workbooks that match the import templates of the new AssetX platform.
 *
 * Read-only against the source database: the tool only issues SELECT statements.
 *
 * Usage:
 *   node convert.js                          auto-detect server, database AssetsDB
 *   node convert.js --server "PC\\SQLEXPRESS02" --database AssetsDB
 *   node convert.js --from-raw "<dir>"       use previously exported raw files (offline test)
 *   node convert.js --out "<dir>"            output folder (default: ./out)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildWorkbookBuffer } = require('./lib/xlsx-writer.js');

const ARGS = (() => {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i += 1; } else { out[key] = true; }
    }
  }
  return out;
})();

const ROOT = __dirname;
const OUT_DIR = ARGS.out ? path.resolve(ARGS.out) : path.join(ROOT, 'out');
const RAW_DIR = ARGS['from-raw'] ? path.resolve(ARGS['from-raw']) : path.join(OUT_DIR, 'raw');
const DATABASE = ARGS.database || process.env.ASSETX_SRC_DB || 'AssetsDB';

const log = (message) => console.log(message);

// ---------------------------------------------------------------- sqlcmd layer
function locateSqlcmd() {
  const candidates = [];
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  candidates.push(path.join(pf, 'Microsoft SQL Server', 'Client SDK', 'ODBC', '170', 'Tools', 'Binn', 'SQLCMD.EXE'));
  candidates.push(path.join(pf, 'Microsoft SQL Server', 'Client SDK', 'ODBC', '180', 'Tools', 'Binn', 'SQLCMD.EXE'));
  for (const base of [pf, pf86]) {
    const root = path.join(base, 'Microsoft SQL Server');
    if (fs.existsSync(root)) {
      for (const entry of fs.readdirSync(root)) {
        candidates.push(path.join(root, entry, 'Tools', 'Binn', 'SQLCMD.EXE'));
        const sdk = path.join(root, entry, 'Client SDK', 'ODBC');
        if (fs.existsSync(sdk)) {
          for (const odbc of fs.readdirSync(sdk)) candidates.push(path.join(sdk, odbc, 'Tools', 'Binn', 'SQLCMD.EXE'));
        }
      }
    }
  }
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  const where = spawnSync('where', ['sqlcmd'], { encoding: 'utf8' });
  if (where.status === 0 && where.stdout) {
    const first = where.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
    if (first && fs.existsSync(first)) return first;
  }
  return null;
}

function sqlcmdToFile(sqlcmd, server, database, query, outputFile) {
  const args = ['-S', server, '-E', '-C', '-d', database, '-W', '-s|', '-f', '65001', '-h', '-1', '-Q', `SET NOCOUNT ON; ${query}`, '-o', outputFile];
  let result = spawnSync(sqlcmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    const withoutTrust = args.filter((arg) => arg !== '-C');
    const retry = spawnSync(sqlcmd, withoutTrust, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (retry.status === 0) { result = retry; }
  }
  return result;
}

function listDatabases(sqlcmd, server) {
  const file = path.join(OUT_DIR, 'databases.txt');
  const result = sqlcmdToFile(sqlcmd, server, 'master', 'SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name', file);
  if (result.status !== 0 && !fs.existsSync(file)) return [];
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '') : '';
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^Msg \d+/.test(line));
}

function detectServer(sqlcmd) {
  const candidates = [];
  const host = process.env.COMPUTERNAME || '';
  const push = (value) => { if (value && !candidates.includes(value)) candidates.push(value); };
  push('.\\SQLEXPRESS02'); push('.\\SQLEXPRESS'); push('localhost\\SQLEXPRESS02'); push('localhost\\SQLEXPRESS');
  if (host) { push(`${host}\\SQLEXPRESS02`); push(`${host}\\SQLEXPRESS`); }
  for (const root of ['HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL', 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL']) {
    const reg = spawnSync('reg', ['query', root], { encoding: 'utf8' });
    if (reg.status === 0 && reg.stdout) {
      for (const line of reg.stdout.split(/\r?\n/)) {
        const match = line.match(/REG_SZ\s+(\S+)/);
        if (!match) continue;
        push(match[1] === 'MSSQLSERVER' ? 'localhost' : `localhost\\${match[1]}`);
      }
    }
  }
  push('localhost'); push('127.0.0.1'); push('.');

  for (const candidate of candidates) {
    const args = ['-S', candidate, '-E', '-C', '-l', '4', '-b', '-Q', 'SET NOCOUNT ON; SELECT 1'];
    let probe = spawnSync(sqlcmd, args, { encoding: 'utf8' });
    if (probe.status !== 0) probe = spawnSync(sqlcmd, args.filter((a) => a !== '-C'), { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------- table export
const TABLES = {
  main_locations: {
    table: 'tblMainLocations',
    columns: [
      ['MainLocationID', 'int'], ['MainLocationCode', 'text', 100], ['MainLocationName', 'text', 200], ['IsActive', 'bit'],
    ],
  },
  sub_locations: {
    table: 'tblSubLocations',
    columns: [
      ['SubLocationID', 'int'], ['MainLocationID', 'int'], ['ParentSubLocationID', 'int'],
      ['SubLocationCode', 'text', 100], ['SubLocationName', 'text', 200], ['LevelNumber', 'int'], ['IsActive', 'bit'],
    ],
  },
  asset_types: {
    table: 'tblAssetTypes',
    columns: [['AssetTypeID', 'int'], ['AssetTypeCode', 'text', 100], ['AssetTypeName', 'text', 200], ['IsActive', 'bit']],
  },
  sub_types: {
    table: 'tblSubTypeAssets',
    columns: [
      ['SubTypeID', 'int'], ['AssetTypeID', 'int'], ['ParentSubTypeID', 'int'],
      ['SubTypeCode', 'text', 100], ['SubTypeName', 'text', 200], ['LevelNumber', 'int'], ['IsActive', 'bit'],
    ],
  },
  statuses: {
    table: 'tblStatus',
    columns: [['StatusID', 'int'], ['StatusCode', 'text', 50], ['StatusName', 'text', 100], ['StatusColor', 'text', 20], ['IsActive', 'bit']],
  },
  employees: {
    table: 'tblEmployees',
    columns: [
      ['EmployeeID', 'int'], ['EmployeeCode', 'text', 50], ['EmployeeName', 'text', 200], ['JobTitle', 'text', 150],
      ['Department', 'text', 150], ['Phone', 'text', 50], ['Email', 'text', 150], ['IsActive', 'bit'],
    ],
  },
  assets: {
    table: 'tblAssets',
    columns: [
      ['AssetID', 'int'], ['AssetName', 'text', 300], ['BaseAssetCode', 'text', 100], ['FullAssetCode', 'text', 400],
      ['Description', 'text', 600], ['AssetTypeID', 'int'], ['SubTypeID', 'int'], ['ModelID', 'int'],
      ['MainLocationID', 'int'], ['SubLocationID', 'int'], ['Quantity', 'int'], ['StatusID', 'int'], ['EmployeeID', 'int'],
      ['PurchasePrice', 'decimal'], ['PurchaseDate', 'datetime'], ['SerialNumber', 'text', 150], ['Barcode', 'text', 150],
      ['Notes', 'text', 4000], ['IsActive', 'bit'],
    ],
  },
  models: {
    optional: true, table: 'tblAssetModels',
    columns: [['ModelID', 'int'], ['ModelName', 'text', 200], ['AssetTypeID', 'int'], ['SubTypeID', 'int'], ['Manufacturer', 'text', 150], ['Supplier', 'text', 150], ['IsActive', 'bit']],
  },
  users: {
    optional: true, table: 'tblUsers',
    columns: [['UserID', 'int'], ['Username', 'text', 100], ['FullName', 'text', 200], ['UserRole', 'text', 100], ['Department', 'text', 150], ['Email', 'text', 150], ['Phone', 'text', 50], ['IsActive', 'bit']],
  },
  cycles: {
    optional: true, table: 'tblInventoryCycles',
    columns: [['CycleID', 'int'], ['CycleName', 'text', 200], ['CycleYear', 'int'], ['StartDate', 'datetime'], ['EndDate', 'datetime'], ['CycleStatus', 'text', 50]],
  },
};

function columnExpression([name, kind, size]) {
  if (kind === 'int') return `ISNULL(CONVERT(varchar(20), [${name}]), '')`;
  if (kind === 'bit') return `ISNULL(CONVERT(varchar(1), [${name}]), '')`;
  if (kind === 'decimal') return `ISNULL(CONVERT(varchar(50), [${name}]), '')`;
  if (kind === 'datetime') return `ISNULL(CONVERT(varchar(30), [${name}], 120), '')`;
  const limit = size || 200;
  return `ISNULL(REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(${limit}), [${name}]), '|', '/'), CHAR(13), ' '), CHAR(10), ' '), '')`;
}

function selectExpression(key) {
  const spec = TABLES[key];
  // sqlcmd writes the -s| separator between columns; text pipes are replaced in SQL, so parsing is exact.
  return `SELECT ${spec.columns.map(columnExpression).join(', ')} FROM dbo.[${spec.table}]`;
}

function exportAll(sqlcmd, server) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const failures = [];
  for (const key of Object.keys(TABLES)) {
    const spec = TABLES[key];
    const file = path.join(RAW_DIR, `${key}.txt`);
    const result = sqlcmdToFile(sqlcmd, server, DATABASE, selectExpression(key), file);
    let body = '';
    if (fs.existsSync(file)) body = fs.readFileSync(file, 'utf8');
    const errorLine = (body.split(/\r?\n/).find((line) => /^\s*Msg \d+/.test(line)) || '').trim();
    const stderr = String(result.stderr || '').trim();
    const failed = result.status !== 0 || errorLine || (stderr && /Msg \d+/.test(stderr));
    if (failed && !spec.optional) failures.push(`${key}: ${errorLine || stderr || `exit ${result.status}`}`);
    else if (failed) log(`   skipped ${key} (table not available)`);
    else log(`   exported ${key}`);
  }
  return failures;
}

// ---------------------------------------------------------------- raw parsing
function readRaw(key) {
  const file = path.join(RAW_DIR, `${key}.txt`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const spec = TABLES[key];
  const rows = [];
  const problems = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed.trim()) continue;
    if (/^\s*Msg \d+/.test(trimmed)) { problems.push(trimmed.trim()); continue; }
    const parts = trimmed.split('|');
    if (parts.length !== spec.columns.length) { problems.push(`unexpected column count (${parts.length}) in: ${trimmed.slice(0, 80)}`); continue; }
    const row = {};
    spec.columns.forEach(([name], index) => { row[name] = parts[index].trim(); });
    rows.push(row);
  }
  return { rows, problems };
}

// ---------------------------------------------------------------- helpers
const norm = (value) => String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const str = (value) => {
  const out = String(value == null ? '' : value).trim();
  return out.toUpperCase() === 'NULL' ? '' : out;
};
const int = (value) => { const n = Number.parseInt(str(value), 10); return Number.isFinite(n) ? n : null; };
const bool = (value) => str(value) === '1';
const num = (value) => { const n = Number(str(value).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const dateOnly = (value) => { const match = str(value).match(/^(\d{4}-\d{2}-\d{2})/); return match ? match[1] : ''; };
const cut = (value, size) => { const out = str(value); return out.length > size ? out.slice(0, size) : out; };

/** Makes every name unique (the new platform resolves parents and references by name). */
function uniquify(entries, getName, setName) {
  const seen = new Map();
  const renamed = [];
  for (const entry of entries) {
    const base = str(getName(entry));
    if (!base) continue;
    const key = norm(base);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count === 1) continue;
    let candidate = `${base} (${count})`;
    let attempt = count;
    while (seen.has(norm(candidate))) { attempt += 1; candidate = `${base} (${attempt})`; }
    seen.set(norm(candidate), 1);
    renamed.push({ from: base, to: candidate });
    setName(entry, candidate);
  }
  return renamed;
}

/**
 * Orders nodes so that every parent appears before its children.
 * Returns the ordered list plus the parent link that survives cycle detection.
 */
function orderHierarchy(nodes, parentOf) {
  const byId = new Map(nodes.map((node) => [node.uid, node]));
  const ordered = [];
  const state = new Map();
  const visit = (node) => {
    if (!node) return;
    const current = state.get(node.uid);
    if (current === 'done' || current === 'visiting') return;
    state.set(node.uid, 'visiting');
    const parent = byId.get(parentOf(node));
    if (parent && parent !== node) visit(parent);
    state.set(node.uid, 'done');
    ordered.push(node);
  };
  for (const node of nodes) visit(node);

  // Second pass: the platform rejects a child that arrives before its parent, so a broken
  // link (cycle) is dropped and the node is treated as a root instead.
  const placed = new Set();
  const finalParent = new Map();
  let broken = 0;
  for (const node of ordered) {
    const parentUid = parentOf(node);
    const parent = parentUid ? byId.get(parentUid) : null;
    if (parent && parent !== node && placed.has(parent.uid)) finalParent.set(node.uid, parent.uid);
    else if (parent && parent !== node) broken += 1;
    placed.add(node.uid);
  }
  return { ordered, finalParent, broken };
}

// ---------------------------------------------------------------- workbook output
const XLSX_HEADERS = {
  locations: ['اسم الموقع', 'الموقع الأب', 'نوع الموقع'],
  categories: ['اسم النوع', 'النوع الأب'],
  statuses: ['اسم الحالة', 'اللون'],
  employees: ['اسم الموظف', 'القسم', 'الهاتف', 'البريد الإلكتروني'],
  assets: ['اسم الأصل', 'نوع الأصل', 'الموقع', 'الحالة', 'الكمية', 'سعر الشراء', 'تاريخ الشراء', 'الموظف', 'الرقم التسلسلي', 'الباركود', 'الوصف', 'ملاحظات'],
};
const XLSX_WIDTHS = {
  locations: [34, 30, 14],
  categories: [36, 30],
  statuses: [26, 12],
  employees: [32, 24, 18, 30],
  assets: [34, 30, 40, 18, 10, 14, 14, 26, 20, 18, 40, 46],
};
const SHEET_NAMES = { locations: 'المواقع', categories: 'أنواع الأصول', statuses: 'الحالات', employees: 'الموظفون', assets: 'الأصول' };

function writeWorkbook(fileName, kind, rows) {
  const buffer = buildWorkbookBuffer({ name: SHEET_NAMES[kind], headers: XLSX_HEADERS[kind], widths: XLSX_WIDTHS[kind], rows });
  const target = path.join(OUT_DIR, fileName);
  fs.writeFileSync(target, buffer);
  return { target, size: buffer.length };
}

const MAX_UPLOAD_BYTES = 1.9 * 1024 * 1024;

function writeAssetsWorkbook(rows) {
  const single = writeWorkbook('5-assets.xlsx', 'assets', rows);
  if (single.size <= MAX_UPLOAD_BYTES) return [single];
  fs.unlinkSync(single.target);
  const parts = Math.ceil(single.size / MAX_UPLOAD_BYTES) + 1;
  const perPart = Math.ceil(rows.length / parts);
  const written = [];
  for (let index = 0; index < rows.length; index += perPart) {
    const slice = rows.slice(index, index + perPart);
    written.push(writeWorkbook(`5-assets-part${written.length + 1}.xlsx`, 'assets', slice));
  }
  return written;
}

// ---------------------------------------------------------------- transformation
function buildImportFiles(raw) {
  const report = { lines: [], warnings: [], renames: { locations: [], categories: [], statuses: [], employees: [], assets: [] }, counts: {} };

  // ---- locations (main locations are the roots, sub locations keep their hierarchy)
  const mains = (raw.main_locations?.rows || []).map((row) => ({
    kind: 'main', id: int(row.MainLocationID), name: str(row.MainLocationName), parentId: null, active: bool(row.IsActive), level: 0,
  })).filter((node) => node.id !== null && node.name);
  const subs = (raw.sub_locations?.rows || []).map((row) => ({
    kind: 'sub', id: int(row.SubLocationID), name: str(row.SubLocationName),
    parentId: int(row.ParentSubLocationID), mainId: int(row.MainLocationID), active: bool(row.IsActive), level: int(row.LevelNumber) || 1,
  })).filter((node) => node.id !== null && node.name);

  const locationNodes = [...mains, ...subs];
  locationNodes.forEach((node) => { node.uid = `${node.kind}:${node.id}`; });
  const byUid = new Map(locationNodes.map((node) => [node.uid, node]));

  const locationParent = (node) => {
    if (node.kind === 'main') return null;
    if (node.parentId !== null && byUid.has(`sub:${node.parentId}`)) return `sub:${node.parentId}`;
    if (node.mainId !== null && byUid.has(`main:${node.mainId}`)) return `main:${node.mainId}`;
    return null;
  };
  const danglingSubParents = subs.filter((node) => node.parentId !== null && !byUid.has(`sub:${node.parentId}`) && node.mainId !== null && byUid.has(`main:${node.mainId}`)).length;
  const withoutParent = subs.filter((node) => locationParent(node) === null).length;

  const { ordered: locationOrdered, finalParent: locationLinks, broken: locationBroken } = orderHierarchy(locationNodes, locationParent);
  report.renames.locations = uniquify(locationOrdered, (node) => node.name, (node, value) => { node.name = value; });

  const locationPath = new Map();
  const locationRows = [];
  for (const node of locationOrdered) {
    const parent = byUid.get(locationLinks.get(node.uid)) || null;
    const fullPath = parent ? `${locationPath.get(parent.uid)} / ${node.name}` : node.name;
    locationPath.set(node.uid, fullPath);
    node.fullPath = fullPath;
    locationRows.push([node.name, parent ? parent.name : '', node.kind === 'main' ? 'building' : 'room']);
  }
  if (danglingSubParents) report.warnings.push(`${danglingSubParents} موقع فرعي كان أبوه مفقوداً؛ تم إرجاعه إلى الموقع الرئيسي التابع له.`);
  if (withoutParent) report.warnings.push(`${withoutParent} موقع فرعي بلا موقع رئيسي؛ تم إدخاله كموقع رئيسي.`);
  if (locationBroken) report.warnings.push(`${locationBroken} موقع كانت علاقته دائرية؛ تم إدخاله كموقع رئيسي.`);

  // ---- categories (asset types are the roots, sub types keep their hierarchy)
  const types = (raw.asset_types?.rows || []).map((row) => ({
    kind: 'type', id: int(row.AssetTypeID), name: str(row.AssetTypeName), parentId: null, active: bool(row.IsActive),
  })).filter((node) => node.id !== null && node.name);
  const subTypes = (raw.sub_types?.rows || []).map((row) => ({
    kind: 'sub', id: int(row.SubTypeID), name: str(row.SubTypeName), parentId: int(row.ParentSubTypeID), typeId: int(row.AssetTypeID), active: bool(row.IsActive),
  })).filter((node) => node.id !== null && node.name);

  const categoryNodes = [...types, ...subTypes];
  categoryNodes.forEach((node) => { node.uid = `${node.kind}:${node.id}`; });
  const categoryByUid = new Map(categoryNodes.map((node) => [node.uid, node]));

  const categoryParent = (node) => {
    if (node.kind === 'type') return null;
    if (node.parentId !== null && categoryByUid.has(`sub:${node.parentId}`)) return `sub:${node.parentId}`;
    if (node.typeId !== null && categoryByUid.has(`type:${node.typeId}`)) return `type:${node.typeId}`;
    return null;
  };
  const danglingTypeParents = subTypes.filter((node) => node.parentId !== null && !categoryByUid.has(`sub:${node.parentId}`) && node.typeId !== null && categoryByUid.has(`type:${node.typeId}`)).length;
  const typesWithoutParent = subTypes.filter((node) => categoryParent(node) === null).length;

  const { ordered: categoryOrdered, finalParent: categoryLinks, broken: categoryBroken } = orderHierarchy(categoryNodes, categoryParent);
  report.renames.categories = uniquify(categoryOrdered, (node) => node.name, (node, value) => { node.name = value; });

  const categoryRows = [];
  for (const node of categoryOrdered) {
    const parent = categoryByUid.get(categoryLinks.get(node.uid)) || null;
    categoryRows.push([node.name, parent ? parent.name : '']);
  }
  if (danglingTypeParents) report.warnings.push(`${danglingTypeParents} نوع فرعي كان أبوه مفقوداً؛ تم إرجاعه إلى نوع الأصل التابع له.`);
  if (typesWithoutParent) report.warnings.push(`${typesWithoutParent} نوع فرعي بلا نوع أصل؛ تم إدخاله كنوع رئيسي.`);
  if (categoryBroken) report.warnings.push(`${categoryBroken} نوع كان تصنيفه دائرياً؛ تم إدخاله كنوع رئيسي.`);

  // ---- statuses
  const statuses = (raw.statuses?.rows || []).map((row) => ({
    id: int(row.StatusID), name: str(row.StatusName), color: str(row.StatusColor), active: bool(row.IsActive),
  })).filter((row) => row.id !== null && row.name);
  report.renames.statuses = uniquify(statuses, (row) => row.name, (row, value) => { row.name = value; });
  const statusRows = statuses.map((row) => [row.name, /^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color : '#64748b']);

  // ---- employees
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let invalidEmails = 0;
  const employees = (raw.employees?.rows || []).map((row) => {
    const email = str(row.Email);
    const safeEmail = EMAIL.test(email) ? email : '';
    if (email && !safeEmail) invalidEmails += 1;
    return {
      id: int(row.EmployeeID), name: str(row.EmployeeName), department: cut(str(row.Department) || str(row.JobTitle), 100),
      phone: cut(str(row.Phone), 30), email: safeEmail, active: bool(row.IsActive),
    };
  }).filter((row) => row.id !== null && row.name);
  report.renames.employees = uniquify(employees, (row) => row.name, (row, value) => { row.name = value; });
  const employeeRows = employees.map((row) => [row.name, row.department, row.phone, row.email]);
  if (invalidEmails) report.warnings.push(`${invalidEmails} بريد إلكتروني غير صالح تم تركه فارغاً حتى لا يُرفض الموظف.`);

  const employeeByName = new Map(employees.map((row) => [norm(row.name), row]));
  const statusByName = new Map(statuses.map((row) => [norm(row.name), row]));
  const categoryByName = new Map(categoryOrdered.map((node) => [norm(node.name), node]));

  // ---- assets
  const assets = [];
  let missingCategory = 0, missingLocation = 0, missingStatus = 0, missingEmployee = 0, emptyName = 0;
  for (const row of raw.assets?.rows || []) {
    const rawName = str(row.AssetName);
    let name = rawName;
    if (!name) { emptyName += 1; name = `أصل ${str(row.BaseAssetCode) || str(row.AssetID)}`; }

    const subType = int(row.SubTypeID) !== null ? categoryByUid.get(`sub:${int(row.SubTypeID)}`) : null;
    const mainType = int(row.AssetTypeID) !== null ? categoryByUid.get(`type:${int(row.AssetTypeID)}`) : null;
    const category = subType || mainType || null;
    if (!category) missingCategory += 1;

    const subLocation = int(row.SubLocationID) !== null ? byUid.get(`sub:${int(row.SubLocationID)}`) : null;
    const mainLocation = int(row.MainLocationID) !== null ? byUid.get(`main:${int(row.MainLocationID)}`) : null;
    const location = subLocation || mainLocation || null;
    if (!location) missingLocation += 1;

    const status = int(row.StatusID) !== null ? statuses.find((item) => item.id === int(row.StatusID)) : null;
    if (!status) missingStatus += 1;

    const employee = int(row.EmployeeID) !== null ? employees.find((item) => item.id === int(row.EmployeeID)) : null;
    if (!employee && int(row.EmployeeID) !== null) missingEmployee += 1;

    const quantity = num(row.Quantity);
    const price = num(row.PurchasePrice);
    const description = cut(str(row.Description), 500);
    const notes = cut(str(row.Notes), 4000);

    assets.push({
      name, categoryName: category ? category.name : '', locationPath: location ? location.fullPath : '',
      statusName: status ? status.name : '', employeeName: employee ? employee.name : '',
      quantity: quantity !== null && quantity > 0 ? quantity : 1,
      price: price !== null && price > 0 ? price : '',
      purchaseDate: dateOnly(row.PurchaseDate),
      serial: cut(str(row.SerialNumber), 100), barcode: cut(str(row.Barcode), 100),
      description, notes,
      code: str(row.FullAssetCode) || str(row.BaseAssetCode) || str(row.AssetID),
      active: bool(row.IsActive),
    });
  }

  // Fallback master rows so that every asset reference resolves.
  const fallbackCategory = 'غير مصنف';
  if (missingCategory && !categoryByName.has(norm(fallbackCategory))) categoryRows.push([fallbackCategory, '']);
  const fallbackLocation = 'غير محدد';
  let fallbackLocationPath = '';
  if (missingLocation && !locationPath.has(norm(fallbackLocation))) {
    locationRows.push([fallbackLocation, '', 'building']);
    fallbackLocationPath = fallbackLocation;
  } else if (missingLocation) {
    fallbackLocationPath = locationPath.get(norm(fallbackLocation)) || fallbackLocation;
  }
  const fallbackStatus = 'غير محدد';
  if (missingStatus && !statusByName.has(norm(fallbackStatus))) statusRows.push([fallbackStatus, '#64748b']);

  // Keep asset names unique per location: the platform skips duplicates.
  const assetSeen = new Map();
  let renamedAssets = 0;
  for (const asset of assets) {
    const categoryName = asset.categoryName || fallbackCategory;
    const locationName = asset.locationPath || fallbackLocationPath || fallbackLocation;
    const statusName = asset.statusName || fallbackStatus;
    let key = `${norm(asset.name)}|${norm(locationName)}`;
    const count = (assetSeen.get(key) || 0) + 1;
    assetSeen.set(key, count);
    if (count > 1) {
      asset.name = `${asset.name} (${asset.code})`;
      renamedAssets += 1;
      key = `${norm(asset.name)}|${norm(locationName)}`;
      let attempt = 1;
      while (assetSeen.has(key)) { attempt += 1; asset.name = `${asset.name.replace(/\s\(\d+\)$/, '')} (${attempt})`; key = `${norm(asset.name)}|${norm(locationName)}`; }
      assetSeen.set(key, 1);
    }
    asset.final = [asset.name, categoryName, locationName, statusName, asset.quantity, asset.price, asset.purchaseDate, asset.employeeName, asset.serial, asset.barcode, asset.description, asset.notes];
  }
  report.renames.assets = renamedAssets;

  const assetRows = assets.map((asset) => asset.final);
  report.counts = {
    locations: locationRows.length, mains: locationOrdered.filter((n) => n.kind === 'main').length,
    categories: categoryRows.length, statuses: statusRows.length, employees: employeeRows.length, assets: assetRows.length,
    missingCategory, missingLocation, missingStatus, missingEmployee, emptyName, renamedAssets,
    models: (raw.models?.rows || []).length, users: (raw.users?.rows || []).length, cycles: (raw.cycles?.rows || []).length,
  };
  return { locationRows, categoryRows, statusRows, employeeRows, assetRows, report };
}

// ---------------------------------------------------------------- main
function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!ARGS['from-raw']) {
    const sqlcmd = locateSqlcmd();
    if (!sqlcmd) { console.error('ERROR NO-SQLCMD: sqlcmd not found.'); process.exit(2); }
    log(`[1/4] sqlcmd: ${sqlcmd}`);
    const server = ARGS.server || process.env.ASSETX_SRC_SERVER || detectServer(sqlcmd);
    if (!server) { console.error('ERROR NO-CONNECTION: could not connect to SQL Server.'); process.exit(3); }
    const databases = listDatabases(sqlcmd, server);
    if (databases.length && !databases.some((name) => name.toLowerCase() === DATABASE.toLowerCase())) {
      console.error(`ERROR NO-DATABASE: the database "${DATABASE}" was not found on ${server}.`);
      console.error('Available databases: ' + databases.join(', '));
      console.error('Run again with the right name, for example:  2-convert-db.bat --database <name>');
      process.exit(5);
    }
    log(`[2/4] connected: ${server} | database: ${DATABASE}`);
    log('[3/4] exporting legacy tables ...');
    const failures = exportAll(sqlcmd, server);
    if (failures.length) {
      console.error('ERROR EXPORT-FAILED:');
      failures.forEach((line) => console.error('   ' + line));
      process.exit(4);
    }
  } else {
    log(`[1/4] offline mode, reading raw files from: ${RAW_DIR}`);
  }

  log('[4/4] building Excel workbooks ...');
  const raw = {};
  for (const key of Object.keys(TABLES)) {
    const parsed = readRaw(key);
    raw[key] = parsed || { rows: [], problems: [] };
    if (parsed && parsed.problems.length) log(`   note: ${key} had ${parsed.problems.length} unreadable line(s); first: ${parsed.problems[0]}`);
  }

  const { locationRows, categoryRows, statusRows, employeeRows, assetRows, report } = buildImportFiles(raw);

  const files = [];
  files.push(writeWorkbook('1-locations.xlsx', 'locations', locationRows));
  files.push(writeWorkbook('2-categories.xlsx', 'categories', categoryRows));
  files.push(writeWorkbook('3-statuses.xlsx', 'statuses', statusRows));
  files.push(writeWorkbook('4-employees.xlsx', 'employees', employeeRows));
  files.push(...writeAssetsWorkbook(assetRows));

  const summary = [];
  summary.push('تقرير تحويل بيانات AssetX القديمة');
  summary.push('=================================');
  summary.push(`التاريخ: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
  summary.push(`قاعدة البيانات المصدر: ${DATABASE}`);
  summary.push('');
  summary.push('عدد السجلات في الملفات الجديدة:');
  summary.push(`- 1-locations.xlsx  : ${report.counts.locations} موقع (منها ${report.counts.mains} موقعاً رئيسياً)`);
  summary.push(`- 2-categories.xlsx : ${report.counts.categories} نوع أصل`);
  summary.push(`- 3-statuses.xlsx   : ${report.counts.statuses} حالة`);
  summary.push(`- 4-employees.xlsx  : ${report.counts.employees} موظفاً`);
  summary.push(`- 5-assets.xlsx     : ${report.counts.assets} أصلاً`);
  summary.push('');
  summary.push('ملفات تم إنتاجها:');
  files.forEach((file) => summary.push(`- ${path.basename(file.target)} (${Math.round(file.size / 1024)} كيلوبايت)`));
  summary.push('');
  summary.push('ملاحظات الترجمة:');
  summary.push(`- أسماء المواقع المتكررة التي أُضيف لها رقم: ${report.renames.locations.length}`);
  summary.push(`- أسماء الأنواع المتكررة التي أُضيف لها رقم: ${report.renames.categories.length}`);
  summary.push(`- أسماء الحالات المتكررة التي أُضيف لها رقم: ${report.renames.statuses.length}`);
  summary.push(`- أسماء الموظفين المتكررة التي أُضيف لها رقم: ${report.renames.employees.length}`);
  summary.push(`- أسماء أصول متكررة في نفس الموقع أُضيف لها رمز الأصل: ${report.counts.renamedAssets}`);
  summary.push(`- أصول بلا نوع (استُخدم "غير مصنف"): ${report.counts.missingCategory}`);
  summary.push(`- أصول بلا موقع (استُخدم "غير محدد"): ${report.counts.missingLocation}`);
  summary.push(`- أصول بلا حالة (استُخدم "غير محدد"): ${report.counts.missingStatus}`);
  summary.push(`- أصول أشارت إلى موظف غير موجود: ${report.counts.missingEmployee}`);
  report.warnings.forEach((warning) => summary.push(`- تنبيه: ${warning}`));
  summary.push('');
  summary.push('بيانات لن تُنقل في هذه المرحلة (غير مدعومة في صفحة استيراد البيانات):');
  summary.push(`- الموديلات: ${report.counts.models} موديلاً (تُنشأ يدوياً لاحقاً).`);
  summary.push(`- المستخدمون: ${report.counts.users} مستخدماً (تُنشأ حساباتهم من شاشة المستخدمين).`);
  summary.push(`- دورات الجرد: ${report.counts.cycles} دورة (الجرد يبدأ من النظام الجديد).`);
  summary.push('');
  summary.push('الخطوات التالية:');
  summary.push('1) ادخل النظام الجديد ثم صفحة "استيراد البيانات".');
  summary.push('2) اختر النوع "المواقع" وارفع الملف 1-locations.xlsx ثم اضغط تنفيذ الاستيراد.');
  summary.push('3) كرر بالترتيب: الأنواع (2) ثم الحالات (3) ثم الموظفون (4) ثم الأصول (5).');
  summary.push('   الترتيب مهم: الأصول تحتاج المواقع والأنواع والحالات والموظفين.');
  summary.push('4) إن ظهرت أخطاء في الأصول، أرسل لي أول 10 أسطر من قائمة الأخطاء.');

  const reportPath = path.join(OUT_DIR, 'conversion-report.txt');
  fs.writeFileSync(reportPath, '\uFEFF' + summary.join('\r\n'), 'utf8');

  log('');
  files.forEach((file) => log(`   created ${path.basename(file.target)} (${Math.round(file.size / 1024)} KB)`));
  log(`   created ${path.basename(reportPath)}`);
  log('');
  log('DONE');
}

if (require.main === module) main();
module.exports = { buildImportFiles, readRaw, TABLES, writeWorkbook };

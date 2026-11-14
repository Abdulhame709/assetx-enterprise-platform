/**
 * Data-quality checks — pure functions that find data-entry mistakes in the
 * asset register. They take plain objects (no database, no clock unless passed
 * in) so they are easy to test. The export providers load the data, call these
 * functions and add the human-readable names.
 *
 * Every finding carries `issues`: short machine codes with parameters. The text
 * for each code is in ISSUE_TEXT (Arabic + English); `issueText()` joins them.
 */
import { foldAssetName } from '../asset-algorithms';

export type DqLang = 'ar' | 'en';

export type DqIssueCode =
  | 'dup_serial' | 'dup_barcode'
  | 'missing_location' | 'missing_type' | 'missing_status' | 'missing_price' | 'missing_date' | 'missing_custodian'
  | 'name_multi_codes' | 'name_multi_types' | 'name_embedded_code'
  | 'qty_not_positive' | 'price_negative' | 'price_high' | 'price_low' | 'date_future' | 'date_too_old'
  | 'stale'
  | 'mv_same_place' | 'mv_back_forth' | 'mv_bulk';

export interface DqIssue {
  code: DqIssueCode;
  params?: Record<string, string | number>;
}

type Params = Record<string, string | number>;

/** Short issue text per code, in both report languages. `{x}` placeholders come from the issue params. */
export const ISSUE_TEXT: Record<DqIssueCode, Record<DqLang, string>> = {
  dup_serial: { ar: 'الرقم التسلسلي مكرر ({value})', en: 'Duplicate serial number ({value})' },
  dup_barcode: { ar: 'الباركود مكرر ({value})', en: 'Duplicate barcode ({value})' },
  missing_location: { ar: 'لا يوجد موقع', en: 'No location' },
  missing_type: { ar: 'لا يوجد نوع', en: 'No type' },
  missing_status: { ar: 'لا توجد حالة', en: 'No status' },
  missing_price: { ar: 'سعر الشراء غير مدخل', en: 'No purchase price' },
  missing_date: { ar: 'تاريخ الشراء غير مدخل', en: 'No purchase date' },
  missing_custodian: { ar: 'الحالة تعني مسلَّم لكن لا يوجد موظف', en: 'Status implies assigned but no custodian' },
  name_multi_codes: { ar: 'نفس الاسم برموز أساسية مختلفة ({count})', en: 'Same name with different base codes ({count})' },
  name_multi_types: { ar: 'نفس الاسم بأنواع مختلفة ({count})', en: 'Same name under different types ({count})' },
  name_embedded_code: { ar: 'الاسم يحتوي رمزاً قديماً ({code})', en: 'Name contains an old code ({code})' },
  qty_not_positive: { ar: 'الكمية صفر أو سالبة ({value})', en: 'Quantity is zero or negative ({value})' },
  price_negative: { ar: 'السعر سالب ({value})', en: 'Negative price ({value})' },
  price_high: { ar: 'السعر أعلى بكثير من وسيط النوع ({ratio} مرة)', en: 'Price far above the type median ({ratio}x)' },
  price_low: { ar: 'السعر أقل بكثير من وسيط النوع (1/{ratio})', en: 'Price far below the type median (1/{ratio})' },
  date_future: { ar: 'تاريخ الشراء في المستقبل', en: 'Purchase date is in the future' },
  date_too_old: { ar: 'تاريخ الشراء قبل 1990', en: 'Purchase date before 1990' },
  stale: { ar: 'لم يُرَ منذ {days} يوماً', en: 'Not seen for {days} days' },
  mv_same_place: { ar: 'النقل من نفس الموقع إلى نفسه', en: 'Moved from a place to the same place' },
  mv_back_forth: { ar: 'نقل ذهاب وعودة خلال {hours} ساعة', en: 'Moved there and back within {hours} h' },
  mv_bulk: { ar: 'نقل جماعي: {count} حركة لنفس المستخدم خلال {minutes} دقائق', en: 'Bulk move: {count} movements by one user within {minutes} min' },
};

export function issueText(issue: DqIssue, lang: DqLang): string {
  const template = ISSUE_TEXT[issue.code][lang];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(issue.params?.[key] ?? ''));
}

export function issuesText(issues: DqIssue[], lang: DqLang): string {
  return issues.map((i) => issueText(i, lang)).join(lang === 'ar' ? '، ' : '; ');
}

/** The asset fields the checks need. Dates are 'YYYY-MM-DD' (or full ISO) text, or null. */
export interface DqAsset {
  id: string;
  name: string;
  base_asset_code: string;
  category_id: string | null;
  location_id: string | null;
  status_id: string | null;
  /** custodian id; callers pass null for the "not linked to an employee" stand-in */
  employee_id: string | null;
  quantity: number;
  purchase_price: number;
  purchase_date: string | null;
  serial_number: string | null;
  barcode: string | null;
  created_at: string | null;
}

export interface DqFinding<T> {
  item: T;
  issues: DqIssue[];
  /** shared by the rows of one cluster (duplicate group, same-name group, movement pair) */
  group_no?: number;
}

// ───────────────────────── 1. duplicate serial numbers / barcodes ─────────────────────────

const PLACEHOLDER_IDS = new Set([
  'na', 'none', 'null', 'nil', 'unknown', 'test', 'no', 'nan', 'tbd', 'لايوجد', 'بدون', 'غيرموجود', 'غيرمتوفر', 'لاشيء',
]);

/**
 * Comparable form of a serial number / barcode: case, spaces, dashes and Arabic digits ignored.
 * Returns '' for blanks and obvious placeholders (n/a, 0000, xxx, "لا يوجد", 1-2 characters),
 * which are not real identifiers and must never be reported as duplicates of each other.
 */
export function normalizeIdentifier(value: string | null | undefined): string {
  const folded = (value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]/gu, '');
  if (folded.length < 3) return '';
  if (PLACEHOLDER_IDS.has(folded)) return '';
  if (/^[0x]+$/.test(folded)) return '';
  return folded;
}

/**
 * Active assets sharing a serial number or a barcode. Assets linked through either
 * identifier land in one group (so A=B by serial and B=C by barcode is one group of three).
 */
export function findDuplicateIdentifiers(assets: DqAsset[]): DqFinding<DqAsset>[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) { const next = parent.get(cur)!; parent.set(cur, root); cur = next; }
    return root;
  };
  for (const a of assets) parent.set(a.id, a.id);

  const serialOf = new Map<string, string>();
  const barcodeOf = new Map<string, string>();
  const bySerial = new Map<string, DqAsset[]>();
  const byBarcode = new Map<string, DqAsset[]>();
  const bucket = (map: Map<string, DqAsset[]>, key: string, a: DqAsset) => {
    const list = map.get(key);
    if (list) list.push(a); else map.set(key, [a]);
  };
  for (const a of assets) {
    const s = normalizeIdentifier(a.serial_number);
    if (s) { serialOf.set(a.id, s); bucket(bySerial, s, a); }
    const b = normalizeIdentifier(a.barcode);
    if (b) { barcodeOf.set(a.id, b); bucket(byBarcode, b, a); }
  }
  const dupSerial = new Set<string>();
  const dupBarcode = new Set<string>();
  for (const [, list] of bySerial) {
    if (list.length < 2) continue;
    for (const a of list) { dupSerial.add(a.id); parent.set(find(a.id), find(list[0].id)); }
  }
  for (const [, list] of byBarcode) {
    if (list.length < 2) continue;
    for (const a of list) { dupBarcode.add(a.id); parent.set(find(a.id), find(list[0].id)); }
  }

  const clusters = new Map<string, DqAsset[]>();
  for (const a of assets) {
    if (!dupSerial.has(a.id) && !dupBarcode.has(a.id)) continue;
    const root = find(a.id);
    const list = clusters.get(root);
    if (list) list.push(a); else clusters.set(root, [a]);
  }
  const out: DqFinding<DqAsset>[] = [];
  let groupNo = 0;
  for (const list of clusters.values()) {
    groupNo += 1;
    for (const a of list) {
      const issues: DqIssue[] = [];
      if (dupSerial.has(a.id)) issues.push({ code: 'dup_serial', params: { value: (a.serial_number ?? '').trim() } });
      if (dupBarcode.has(a.id)) issues.push({ code: 'dup_barcode', params: { value: (a.barcode ?? '').trim() } });
      out.push({ item: a, issues, group_no: groupNo });
    }
  }
  return out;
}

// ───────────────────────── 2. missing essentials ─────────────────────────

export interface MissingEssentialsContext {
  /** status ids that mean "handed to someone" (a custodian is then expected) */
  assignedStatusIds: ReadonlySet<string>;
}

export function findMissingEssentials(assets: DqAsset[], ctx: MissingEssentialsContext): DqFinding<DqAsset>[] {
  const out: DqFinding<DqAsset>[] = [];
  for (const a of assets) {
    const issues: DqIssue[] = [];
    if (!a.location_id) issues.push({ code: 'missing_location' });
    if (!a.category_id) issues.push({ code: 'missing_type' });
    if (!a.status_id) issues.push({ code: 'missing_status' });
    if (!(Number(a.purchase_price) > 0)) issues.push({ code: 'missing_price' });
    if (!a.purchase_date) issues.push({ code: 'missing_date' });
    if (a.status_id && ctx.assignedStatusIds.has(a.status_id) && !a.employee_id) issues.push({ code: 'missing_custodian' });
    if (issues.length > 0) out.push({ item: a, issues });
  }
  return out;
}

/** Status names (any language) whose meaning is "in someone's hands". */
const ASSIGNED_STATUS_NAMES = new Set(['used', 'in use', 'assigned', 'مستخدم', 'مسلم', 'مسلّم', 'مستعمل']);

export function isAssignedStatusName(name: string | null | undefined): boolean {
  return ASSIGNED_STATUS_NAMES.has((name ?? '').normalize('NFKC').trim().toLocaleLowerCase());
}

// ───────────────────────── 3. naming consistency ─────────────────────────

/**
 * An old-style code that was typed into the asset name, e.g. "2025-0038-13@Main Office"
 * (year-number[-serial][@location]). A bare year range such as "2024-2025" is not a code.
 */
const EMBEDDED_CODE = /\(?\s*((?:19|20)\d{2}-\d{3,6}(?:-\d{1,4})?(?:@[^\s()]*)?)\s*\)?/;

export function stripEmbeddedCode(name: string | null | undefined): { clean: string; code: string | null } {
  const text = (name ?? '').normalize('NFKC');
  const m = EMBEDDED_CODE.exec(text);
  if (!m) return { clean: text.trim(), code: null };
  const code = m[1];
  const isYearRange = /^(?:19|20)\d{2}-(?:19|20)\d{2}$/.test(code);
  if (isYearRange) return { clean: text.trim(), code: null };
  const clean = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  return { clean, code };
}

/**
 * Same name under different base codes or different types, and names that still
 * carry an old code. Names are compared after removing that code and folding
 * spelling variants (see foldAssetName).
 */
export function findInconsistentNaming(assets: DqAsset[]): DqFinding<DqAsset>[] {
  const groups = new Map<string, Array<{ a: DqAsset; code: string | null }>>();
  for (const a of assets) {
    const { clean, code } = stripEmbeddedCode(a.name);
    const key = foldAssetName(clean);
    const entry = { a, code };
    if (!key) {
      // Nothing left but a code: still report the embedded code, in a group of its own.
      if (code) groups.set(`\u0000${a.id}`, [entry]);
      continue;
    }
    const list = groups.get(key);
    if (list) list.push(entry); else groups.set(key, [entry]);
  }
  const out: DqFinding<DqAsset>[] = [];
  let groupNo = 0;
  for (const list of groups.values()) {
    const codes = new Set(list.map((e) => e.a.base_asset_code).filter(Boolean));
    const types = new Set(list.map((e) => e.a.category_id).filter((x): x is string => Boolean(x)));
    const clash = codes.size > 1 || types.size > 1;
    const hasEmbedded = list.some((e) => e.code);
    if (!clash && !hasEmbedded) continue;
    if (clash) groupNo += 1;
    for (const { a, code } of list) {
      const issues: DqIssue[] = [];
      if (codes.size > 1) issues.push({ code: 'name_multi_codes', params: { count: codes.size } });
      if (types.size > 1) issues.push({ code: 'name_multi_types', params: { count: types.size } });
      if (code) issues.push({ code: 'name_embedded_code', params: { code } });
      if (issues.length > 0) out.push({ item: a, issues, ...(clash ? { group_no: groupNo } : {}) });
    }
  }
  return out;
}

// ───────────────────────── 4. quantity / price / date anomalies ─────────────────────────

export const PRICE_HIGH_FACTOR = 5;
export const PRICE_LOW_FACTOR = 10;
export const MIN_PRICE_SAMPLE = 5;
const MIN_PURCHASE_DATE = '1990-01-01';

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median of the positive prices per type (needs at least MIN_PRICE_SAMPLE priced assets). */
export function medianPriceByType(assets: DqAsset[]): Map<string, number> {
  const pools = new Map<string, number[]>();
  for (const a of assets) {
    const price = Number(a.purchase_price);
    if (!a.category_id || !(price > 0)) continue;
    const list = pools.get(a.category_id);
    if (list) list.push(price); else pools.set(a.category_id, [price]);
  }
  const out = new Map<string, number>();
  for (const [type, prices] of pools) if (prices.length >= MIN_PRICE_SAMPLE) out.set(type, median(prices));
  return out;
}

function roundTo(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** ISO date text (first 10 characters) of a date value, or '' when absent/invalid. */
function dateKey(value: string | null | undefined): string {
  const s = (value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

export function findAnomalies(assets: DqAsset[], now: Date): DqFinding<DqAsset>[] {
  const medians = medianPriceByType(assets);
  // Tomorrow is allowed so a clock/time-zone difference never flags "today".
  const limit = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const out: DqFinding<DqAsset>[] = [];
  for (const a of assets) {
    const issues: DqIssue[] = [];
    const qty = Number(a.quantity);
    if (Number.isFinite(qty) && qty <= 0) issues.push({ code: 'qty_not_positive', params: { value: qty } });
    const price = Number(a.purchase_price);
    if (Number.isFinite(price) && price < 0) issues.push({ code: 'price_negative', params: { value: price } });
    const med = a.category_id ? medians.get(a.category_id) : undefined;
    if (med !== undefined && price > 0) {
      if (price > med * PRICE_HIGH_FACTOR) issues.push({ code: 'price_high', params: { ratio: roundTo(price / med), median: roundTo(med, 2) } });
      else if (price < med / PRICE_LOW_FACTOR) issues.push({ code: 'price_low', params: { ratio: roundTo(med / price), median: roundTo(med, 2) } });
    }
    const date = dateKey(a.purchase_date);
    if (date && date > limit) issues.push({ code: 'date_future' });
    else if (date && date < MIN_PURCHASE_DATE) issues.push({ code: 'date_too_old' });
    if (issues.length > 0) out.push({ item: a, issues });
  }
  return out;
}

// ───────────────────────── 5. stale / unverified assets ─────────────────────────

export type SeenSource = 'inventory' | 'movement' | 'created';

export interface SeenObservation {
  asset_id: string;
  /** when the asset was last counted / moved */
  at: string | Date;
  source: Exclude<SeenSource, 'created'>;
}

export interface StaleRow {
  asset: DqAsset;
  last_seen: string;
  source: SeenSource;
  days_since: number;
}

const DAY_MS = 24 * 3600 * 1000;

function toTime(value: string | Date | null | undefined): number {
  if (!value) return NaN;
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/**
 * Assets not seen in any inventory session or movement for at least `days` days.
 * "Seen" = latest inventory record (date or verification) or approved/pending movement;
 * an asset never seen is dated from the day it was created.
 */
export function findStale(assets: DqAsset[], seen: SeenObservation[], now: Date, days: number): DqFinding<StaleRow>[] {
  const latest = new Map<string, { t: number; source: SeenObservation['source'] }>();
  for (const o of seen) {
    const t = toTime(o.at);
    if (Number.isNaN(t)) continue;
    const cur = latest.get(o.asset_id);
    if (!cur || t > cur.t) latest.set(o.asset_id, { t, source: o.source });
  }
  const out: DqFinding<StaleRow>[] = [];
  for (const a of assets) {
    const obs = latest.get(a.id);
    let t = obs?.t ?? NaN;
    let source: SeenSource = obs?.source ?? 'created';
    if (Number.isNaN(t)) { t = toTime(a.created_at); source = 'created'; }
    if (Number.isNaN(t)) continue;
    const daysSince = Math.floor((now.getTime() - t) / DAY_MS);
    if (daysSince < days) continue;
    out.push({
      item: { asset: a, last_seen: new Date(t).toISOString().slice(0, 10), source, days_since: daysSince },
      issues: [{ code: 'stale', params: { days: daysSince } }],
    });
  }
  return out.sort((x, y) => y.item.days_since - x.item.days_since);
}

// ───────────────────────── 6. suspicious movements ─────────────────────────

export interface DqMovement {
  id: string;
  asset_id: string;
  movement_type: string;
  from_location_id: string | null;
  to_location_id: string | null;
  from_employee_id: string | null;
  to_employee_id: string | null;
  from_status_id: string | null;
  to_status_id: string | null;
  performed_by: string | null;
  created_at: string | Date;
  status?: string | null;
}

export const BACK_FORTH_HOURS = 24;
export const BULK_MIN_MOVES = 20;
export const BULK_WINDOW_MINUTES = 10;

/** Movements that look like mistakes. Rejected movements never happened, so they are ignored. */
export function findSuspiciousMovements(movements: DqMovement[], opts: { bulkMin?: number; bulkWindowMinutes?: number } = {}): DqFinding<DqMovement>[] {
  const bulkMin = opts.bulkMin ?? BULK_MIN_MOVES;
  const bulkWindow = (opts.bulkWindowMinutes ?? BULK_WINDOW_MINUTES) * 60 * 1000;
  const live = movements
    .filter((m) => m.status !== 'rejected' && !Number.isNaN(toTime(m.created_at)))
    .sort((x, y) => toTime(x.created_at) - toTime(y.created_at));

  const issuesOf = new Map<string, DqIssue[]>();
  const groupOf = new Map<string, number>();
  const add = (m: DqMovement, issue: DqIssue) => {
    const list = issuesOf.get(m.id);
    if (list) list.push(issue); else issuesOf.set(m.id, [issue]);
  };
  let groupNo = 0;

  // a) a transfer that changes nothing
  for (const m of live) {
    if (m.movement_type !== 'transfer') continue;
    if (!m.from_location_id || m.from_location_id !== m.to_location_id) continue;
    const sameEmployee = (m.from_employee_id ?? null) === (m.to_employee_id ?? null);
    const sameStatus = (m.from_status_id ?? null) === (m.to_status_id ?? null);
    if (sameEmployee && sameStatus) add(m, { code: 'mv_same_place' });
  }

  // b) X → Y followed by Y → X on the same asset within 24 h
  const byAsset = new Map<string, DqMovement[]>();
  for (const m of live) {
    if (m.movement_type !== 'transfer' || !m.from_location_id || !m.to_location_id || m.from_location_id === m.to_location_id) continue;
    const list = byAsset.get(m.asset_id);
    if (list) list.push(m); else byAsset.set(m.asset_id, [m]);
  }
  for (const list of byAsset.values()) {
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const cur = list[i];
      const gap = toTime(cur.created_at) - toTime(prev.created_at);
      if (cur.from_location_id === prev.to_location_id && cur.to_location_id === prev.from_location_id && gap <= BACK_FORTH_HOURS * 3600 * 1000) {
        groupNo += 1;
        const issue: DqIssue = { code: 'mv_back_forth', params: { hours: BACK_FORTH_HOURS } };
        add(prev, issue); add(cur, issue);
        groupOf.set(prev.id, groupNo); groupOf.set(cur.id, groupNo);
      }
    }
  }

  // c) one user moving many assets in a short window
  const byUser = new Map<string, DqMovement[]>();
  for (const m of live) {
    if (!m.performed_by) continue;
    const list = byUser.get(m.performed_by);
    if (list) list.push(m); else byUser.set(m.performed_by, [m]);
  }
  for (const list of byUser.values()) {
    let start = 0;
    const flagged = new Set<number>();
    for (let end = 0; end < list.length; end += 1) {
      while (toTime(list[end].created_at) - toTime(list[start].created_at) > bulkWindow) start += 1;
      if (end - start + 1 >= bulkMin) for (let k = start; k <= end; k += 1) flagged.add(k);
    }
    if (flagged.size === 0) continue;
    groupNo += 1;
    const issue: DqIssue = { code: 'mv_bulk', params: { count: flagged.size, minutes: bulkWindow / 60000 } };
    for (const k of flagged) {
      add(list[k], issue);
      if (!groupOf.has(list[k].id)) groupOf.set(list[k].id, groupNo);
    }
  }

  const out: DqFinding<DqMovement>[] = [];
  for (const m of live) {
    const issues = issuesOf.get(m.id);
    if (!issues) continue;
    const group = groupOf.get(m.id);
    out.push({ item: m, issues, ...(group !== undefined ? { group_no: group } : {}) });
  }
  return out;
}

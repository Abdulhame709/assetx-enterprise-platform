/**
 * Cell formatting shared by the CSV, XLSX and PDF generators so one value reads
 * the same in every format (no "[object Object]", no raw JS Date strings).
 */

/** Human-readable text for one report cell. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.replace('T', ' ').slice(0, 19);
  }
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return ''; }
  }
  return String(value);
}

const NUMERIC_TEXT = /^[-+]?\d+(\.\d+)?$/;

/**
 * CSV cells that start with = + - @ (or tab / CR) are executed as formulas by
 * Excel ("CSV injection"). Prefix them with an apostrophe so they stay text.
 * Plain numbers (including negatives) are left untouched.
 */
export function csvSafe(text: string): string {
  if (/^[=+\-@\t\r]/.test(text) && !NUMERIC_TEXT.test(text)) return `'${text}`;
  return text;
}

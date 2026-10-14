/**
 * Cell formatting shared by the CSV, XLSX and PDF generators so one value reads
 * the same in every format (no "[object Object]", no raw JS Date strings).
 */
import { ADDITIVE_KEYS, MONEY_KEYS, NUMERIC_KEYS } from '../../core/constants/export-labels';

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

/** Numeric value of a cell, or null when the cell is not a number. */
export function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && NUMERIC_TEXT.test(value.trim())) return Number(value);
  return null;
}

/** 1234567.5 -> "1,234,567.50" (Latin digits, fixed decimals for money). */
export function formatNumber(value: number, decimals?: number): string {
  const places = decimals ?? (Number.isInteger(value) ? 0 : 2);
  return value.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
}

/**
 * Text printed in a PDF cell. Numbers get thousands separators; text that only
 * looks numeric (barcodes, serial numbers) is left untouched unless the column
 * is a known numeric field.
 */
export function displayText(key: string, value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value, MONEY_KEYS.has(key) ? 2 : undefined) : '';
  if (typeof value === 'string' && NUMERIC_KEYS.has(key)) {
    const n = numericValue(value);
    if (n !== null) return formatNumber(n, MONEY_KEYS.has(key) ? 2 : undefined);
  }
  return cellText(value);
}

/** True when the column holds numbers (end aligned, may be totalled). */
export function isNumericColumn(key: string, rows: unknown[]): boolean {
  if (NUMERIC_KEYS.has(key)) return true;
  let seen = 0;
  for (const row of rows) {
    const v = (row as Record<string, unknown> | null)?.[key];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'number') return false;
    seen += 1;
  }
  return seen > 0;
}

/** Sum of every additive (money/quantity) column; keys with no numeric data are omitted. */
export function columnTotals(keys: string[], rows: unknown[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const key of keys) {
    if (!ADDITIVE_KEYS.has(key)) continue;
    let sum = 0;
    let seen = false;
    for (const row of rows) {
      const n = numericValue((row as Record<string, unknown> | null)?.[key]);
      if (n !== null) { sum += n; seen = true; }
    }
    if (seen) totals[key] = Math.round(sum * 100) / 100;
  }
  return totals;
}

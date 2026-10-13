/**
 * Condition breakdown of a counted quantity (e.g. counted 6 = 3 New · 2 Needs Maintenance · 1 Damaged).
 *
 * The field mobile app stores it inside `inventory_records.notes` as one line:
 *   تفصيل الحالة: New:3 | Needs Maintenance:2 | Damaged:1
 * The format below MUST stay identical to Mobile/AssetXMobile/features/assetx/domain.ts
 * (buildConditionNotes / parseConditionNotes). No database change is needed.
 */

export const CONDITION_PREFIX = 'تفصيل الحالة:';

/** The three conditions the field app asks for, in display order (server status names). */
export const CONDITION_NAMES = ['New', 'Needs Maintenance', 'Damaged'] as const;

export interface ConditionCount { name: string; quantity: number }

const LINE = /تفصيل الحالة:\s*([^\n]*)/;

/** Splits stored notes into the breakdown and the remaining free-text notes. */
export function parseConditionNotes(notes: string | null | undefined): { counts: ConditionCount[]; restNotes: string } {
  if (!notes) return { counts: [], restNotes: '' };
  const match = notes.match(LINE);
  if (!match) return { counts: [], restNotes: notes.trim() };
  const counts: ConditionCount[] = [];
  for (const part of match[1].split('|')) {
    const [rawName, rawQty] = part.split(':').map((value) => value.trim());
    const quantity = Number(rawQty);
    if (rawName && Number.isFinite(quantity) && quantity > 0) counts.push({ name: rawName, quantity });
  }
  return { counts, restNotes: notes.replace(match[0], '').trim() };
}

/** Builds the single breakdown line (null when there is nothing to store). */
export function buildConditionNotes(counts: ConditionCount[]): string | null {
  const parts = counts
    .filter((count) => count.name.trim() && Number.isFinite(count.quantity) && count.quantity > 0)
    .map((count) => `${count.name.trim()}:${count.quantity}`);
  return parts.length ? `${CONDITION_PREFIX} ${parts.join(' | ')}` : null;
}

/** Re-joins free-text notes with the breakdown line; undefined when both are empty. */
export function composeNotes(restNotes: string, counts: ConditionCount[]): string | undefined {
  const breakdown = buildConditionNotes(counts);
  const text = [restNotes.trim(), breakdown].filter(Boolean).join('\n');
  return text || undefined;
}

export function totalCondition(counts: ConditionCount[]): number {
  return counts.reduce((sum, count) => sum + (Number.isFinite(count.quantity) ? count.quantity : 0), 0);
}

/** The condition holding the most units (used as the record's main status). */
export function dominantCondition(counts: ConditionCount[]): string | null {
  const sorted = counts.filter((count) => count.quantity > 0).sort((a, b) => b.quantity - a.quantity);
  return sorted[0]?.name ?? null;
}

/** i18n key for a known condition name (case-insensitive); null for custom statuses. */
export function conditionLabelKey(name: string): string | null {
  const known = CONDITION_NAMES.find((candidate) => candidate.toLowerCase() === name.trim().toLowerCase());
  return known ? `condition.${known.replace(/\s+/g, '')}` : null;
}

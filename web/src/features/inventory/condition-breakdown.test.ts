import { describe, expect, it } from 'vitest';
import {
  buildConditionNotes, composeNotes, conditionLabelKey, dominantCondition, parseConditionNotes, totalCondition,
} from './condition-breakdown';

describe('condition breakdown (shared notes format with the mobile app)', () => {
  it('parses the line written by the mobile app and keeps the other notes', () => {
    const parsed = parseConditionNotes('تم العثور عليه\nالموقع الفعلي: A > B\nتفصيل الحالة: New:3 | Needs Maintenance:2 | Damaged:1');
    expect(parsed.counts).toEqual([
      { name: 'New', quantity: 3 }, { name: 'Needs Maintenance', quantity: 2 }, { name: 'Damaged', quantity: 1 },
    ]);
    expect(parsed.restNotes).toBe('تم العثور عليه\nالموقع الفعلي: A > B');
    expect(totalCondition(parsed.counts)).toBe(6);
    expect(dominantCondition(parsed.counts)).toBe('New');
  });

  it('round-trips: build(parse(x)) reproduces the same line', () => {
    const line = 'تفصيل الحالة: New:5 | Damaged:1';
    expect(buildConditionNotes(parseConditionNotes(line).counts)).toBe(line);
  });

  it('returns no counts for plain notes or empty values', () => {
    expect(parseConditionNotes('just a note')).toEqual({ counts: [], restNotes: 'just a note' });
    expect(parseConditionNotes(null)).toEqual({ counts: [], restNotes: '' });
    expect(buildConditionNotes([{ name: 'New', quantity: 0 }])).toBeNull();
  });

  it('composeNotes joins free text and breakdown, or yields undefined when empty', () => {
    expect(composeNotes(' hello ', [{ name: 'New', quantity: 2 }])).toBe('hello\nتفصيل الحالة: New:2');
    expect(composeNotes('', [{ name: 'New', quantity: 2 }])).toBe('تفصيل الحالة: New:2');
    expect(composeNotes('only text', [])).toBe('only text');
    expect(composeNotes('  ', [])).toBeUndefined();
  });

  it('maps known condition names to i18n keys and leaves custom ones alone', () => {
    expect(conditionLabelKey('Needs Maintenance')).toBe('condition.NeedsMaintenance');
    expect(conditionLabelKey('damaged')).toBe('condition.Damaged');
    expect(conditionLabelKey('Custom status')).toBeNull();
  });
});

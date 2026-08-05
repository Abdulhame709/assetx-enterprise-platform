import { describe, it, expect } from 'vitest';
import { normalizeList, normalizePaged, humanId } from './normalize';

describe('normalizeList', () => {
  it('passes through an array', () => {
    expect(normalizeList([1, 2, 3])).toEqual([1, 2, 3]);
  });
  it('extracts from items wrapper', () => {
    expect(normalizeList({ items: ['a', 'b'] })).toEqual(['a', 'b']);
  });
  it('extracts from data wrapper', () => {
    expect(normalizeList({ data: [1] })).toEqual([1]);
  });
  it('extracts from results wrapper', () => {
    expect(normalizeList({ results: [{ x: 1 }] })).toEqual([{ x: 1 }]);
  });
  it('returns [] for null/undefined/empty', () => {
    expect(normalizeList(null)).toEqual([]);
    expect(normalizeList(undefined)).toEqual([]);
    expect(normalizeList({})).toEqual([]);
  });
});

describe('normalizePaged', () => {
  it('handles wrapped response with total', () => {
    expect(normalizePaged({ items: [{ id: '1' }], total: 1 })).toEqual({ items: [{ id: '1' }], total: 1 });
  });
  it('handles bare array (total = length)', () => {
    expect(normalizePaged([{ id: '1' }])).toEqual({ items: [{ id: '1' }], total: 1 });
  });
  it('handles data wrapper', () => {
    expect(normalizePaged({ data: [{ id: '1' }], total: 5 })).toEqual({ items: [{ id: '1' }], total: 5 });
  });
  it('empty -> items [] total 0', () => {
    expect(normalizePaged(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe('humanId', () => {
  it('hides a UUID', () => {
    expect(humanId('1708a6fe-cfb9-429d-902a-55d4f73d07f5')).toBe('—');
  });
  it('keeps a non-UUID value', () => {
    expect(humanId('IT')).toBe('IT');
  });
  it('returns fallback for null', () => {
    expect(humanId(null)).toBe('—');
    expect(humanId(undefined, 'N/A')).toBe('N/A');
  });
});

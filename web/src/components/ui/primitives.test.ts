import { describe, expect, it } from 'vitest';
import { initialsOf } from './Avatar';
import { pageWindow } from './Pagination';

describe('initialsOf', () => {
  it('uses the first letters of the first two words', () => {
    expect(initialsOf('Ahmed Ali Hassan')).toBe('AA');
  });
  it('keeps Arabic letters intact', () => {
    expect(initialsOf('محمد علي')).toBe('مع');
  });
  it('falls back for empty names', () => {
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});

describe('pageWindow', () => {
  it('shows every page when few', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
  it('marks gaps around the current page', () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
  });
  it('does not mark a gap between adjacent numbers', () => {
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
  });
});

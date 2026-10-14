/**
 * Unit tests — location grouping for printed reports (main → sub → assets).
 */
import { bandText, detailRows, insertLocationBands, isGroupRow, sortByLocation } from '../src/core/constants/report-groups';

type Row = Record<string, unknown>;
const asset = (name: string, location_name: string): Row => ({ name, location_name });

describe('report location groups', () => {
  const rows: Row[] = [
    asset('d', 'B Main'),
    asset('c', ''),
    asset('b', 'A Main / Sub 2'),
    asset('a', 'A Main'),
    asset('e', 'A Main / Sub 10'),
    asset('f', 'A Main / Sub 2'),
  ];

  it('puts a parent before its children and assets without a location last', () => {
    expect(sortByLocation(rows).map((r) => r.name)).toEqual(['a', 'b', 'f', 'e', 'd', 'c']);
  });

  it('keeps the incoming order inside one location (stable)', () => {
    const sorted = sortByLocation([asset('z', 'X'), asset('a', 'X'), asset('m', 'X')]);
    expect(sorted.map((r) => r.name)).toEqual(['z', 'a', 'm']);
  });

  it('inserts a band per location level with the asset count under it', () => {
    const out = insertLocationBands(sortByLocation(rows));
    const shape = out.map((r) => (isGroupRow(r) ? `[${r.__level}:${r.__group}:${r.__count}]` : String(r.name)));
    expect(shape).toEqual([
      '[0:A Main:4]', 'a', '[1:Sub 2:2]', 'b', 'f', '[1:Sub 10:1]', 'e',
      '[0:B Main:1]', 'd',
      '[0::1]', 'c',
    ]);
  });

  it('detailRows drops the bands', () => {
    expect(detailRows(insertLocationBands(sortByLocation(rows)))).toHaveLength(rows.length);
  });

  it('bandText indents by level and shows a dash for no location', () => {
    expect(bandText({ __group: 'Main', __level: 0, __count: 3 })).toBe('Main (3)');
    expect(bandText({ __group: 'Sub', __level: 1, __count: 2 })).toBe('  Sub (2)');
    expect(bandText({ __group: '', __level: 0, __count: 1 })).toBe('- (1)');
  });

  it('handles an empty list', () => {
    expect(insertLocationBands([])).toEqual([]);
    expect(sortByLocation([])).toEqual([]);
  });
});

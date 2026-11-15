/**
 * Data-quality checks: pure detection functions (no database).
 */
import {
  DqAsset, DqMovement, findAnomalies, findDuplicateIdentifiers, findInconsistentNaming, findMissingEssentials,
  findStale, findSuspiciousMovements, isAssignedStatusName, issueText, issuesText, median, normalizeIdentifier,
  stripEmbeddedCode,
} from '../src/application/export/data-quality';
import { DQ_RESOURCES, DataQualityService, isDataQualityResource } from '../src/application/export/data-quality.service';
import { DataQualityExportProvider } from '../src/application/export/providers/data-quality-export.provider';
import { REPORT_CATALOG } from '../src/core/constants/report-catalog';
import { RESOURCE_TITLES, COLUMN_LABELS } from '../src/core/constants/export-labels';

const NOW = new Date('2026-06-01T12:00:00Z');

function asset(id: string, over: Partial<DqAsset> = {}): DqAsset {
  return {
    id,
    name: `Asset ${id}`,
    base_asset_code: `2026-${id.padStart(4, '0')}`,
    category_id: 'cat-1',
    location_id: 'loc-1',
    status_id: 'st-good',
    employee_id: null,
    quantity: 1,
    purchase_price: 100,
    purchase_date: '2024-01-15',
    serial_number: null,
    barcode: null,
    created_at: '2024-02-01T00:00:00Z',
    ...over,
  };
}

const codes = (f: { issues: Array<{ code: string }> }) => f.issues.map((i) => i.code);

describe('normalizeIdentifier', () => {
  it('ignores case, spaces, dashes and Arabic digits', () => {
    expect(normalizeIdentifier(' SN-123 456 ')).toBe('sn123456');
    expect(normalizeIdentifier('sn123456')).toBe('sn123456');
    expect(normalizeIdentifier('١٢٣٤٥٦')).toBe('123456');
  });

  it('treats blanks and placeholders as no identifier', () => {
    for (const v of [null, undefined, '', '   ', '-', 'N/A', 'n/a', 'none', '0000', 'xxx', 'لا يوجد', 'بدون', 'ab']) {
      expect(normalizeIdentifier(v as string)).toBe('');
    }
  });
});

describe('findDuplicateIdentifiers', () => {
  it('groups assets sharing a serial number regardless of case, spaces and dashes', () => {
    const out = findDuplicateIdentifiers([
      asset('1', { serial_number: 'ABC-123' }),
      asset('2', { serial_number: 'abc 123' }),
      asset('3', { serial_number: 'ZZZ-999' }),
    ]);
    expect(out.map((f) => f.item.id)).toEqual(['1', '2']);
    expect(out[0].group_no).toBe(out[1].group_no);
    expect(codes(out[0])).toEqual(['dup_serial']);
  });

  it('never reports placeholder values as duplicates of each other', () => {
    const out = findDuplicateIdentifiers([
      asset('1', { serial_number: 'N/A', barcode: '0000' }),
      asset('2', { serial_number: 'n/a', barcode: '0000' }),
      asset('3', { serial_number: '', barcode: '' }),
      asset('4', { serial_number: '', barcode: '' }),
    ]);
    expect(out).toEqual([]);
  });

  it('links serial and barcode matches into one group and lists both issues', () => {
    const out = findDuplicateIdentifiers([
      asset('1', { serial_number: 'SER-1', barcode: 'BC-77' }),
      asset('2', { serial_number: 'SER-1' }),
      asset('3', { barcode: 'BC-77' }),
      asset('4', { serial_number: 'OTHER-1' }),
    ]);
    expect(out.map((f) => f.item.id).sort()).toEqual(['1', '2', '3']);
    expect(new Set(out.map((f) => f.group_no)).size).toBe(1);
    expect(codes(out.find((f) => f.item.id === '1')!)).toEqual(['dup_serial', 'dup_barcode']);
  });

  it('numbers separate groups separately', () => {
    const out = findDuplicateIdentifiers([
      asset('1', { serial_number: 'AAA-1' }), asset('2', { serial_number: 'AAA-1' }),
      asset('3', { barcode: 'BBB-2' }), asset('4', { barcode: 'BBB-2' }),
    ]);
    expect(new Set(out.map((f) => f.group_no)).size).toBe(2);
  });
});

describe('findMissingEssentials', () => {
  const ctx = { assignedStatusIds: new Set(['st-used']) };

  it('lists every missing essential on one row per asset', () => {
    const out = findMissingEssentials([
      asset('1', { location_id: null, category_id: null, status_id: null, purchase_price: 0, purchase_date: null }),
    ], ctx);
    expect(out).toHaveLength(1);
    expect(codes(out[0])).toEqual(['missing_location', 'missing_type', 'missing_status', 'missing_price', 'missing_date']);
  });

  it('expects a custodian only when the status implies assigned', () => {
    const out = findMissingEssentials([
      asset('1', { status_id: 'st-used', employee_id: null }),
      asset('2', { status_id: 'st-used', employee_id: 'emp-1' }),
      asset('3', { status_id: 'st-good', employee_id: null }),
    ], ctx);
    expect(out.map((f) => f.item.id)).toEqual(['1']);
    expect(codes(out[0])).toEqual(['missing_custodian']);
  });

  it('skips complete assets', () => {
    expect(findMissingEssentials([asset('1')], ctx)).toEqual([]);
  });

  it('recognises assigned status names in both languages', () => {
    expect(isAssignedStatusName('Used')).toBe(true);
    expect(isAssignedStatusName('مستخدم')).toBe(true);
    expect(isAssignedStatusName('Good')).toBe(false);
    expect(isAssignedStatusName(null)).toBe(false);
  });
});

describe('stripEmbeddedCode', () => {
  it('finds an old code with a location suffix', () => {
    expect(stripEmbeddedCode('Laptop Dell 2025-0038-13@HQ')).toEqual({ clean: 'Laptop Dell', code: '2025-0038-13@HQ' });
  });

  it('finds a parenthesised code', () => {
    expect(stripEmbeddedCode('كرسي مكتب (2024-0150)')).toEqual({ clean: 'كرسي مكتب', code: '2024-0150' });
  });

  it('does not treat a year range or a plain name as a code', () => {
    expect(stripEmbeddedCode('Budget 2024-2025').code).toBeNull();
    expect(stripEmbeddedCode('Printer HP 1020').code).toBeNull();
  });
});

describe('findInconsistentNaming', () => {
  it('flags the same name under different base codes', () => {
    const out = findInconsistentNaming([
      asset('1', { name: 'Office Chair', base_asset_code: '2026-0001' }),
      asset('2', { name: 'office  chair', base_asset_code: '2026-0002' }),
      asset('3', { name: 'Desk', base_asset_code: '2026-0003' }),
    ]);
    expect(out.map((f) => f.item.id)).toEqual(['1', '2']);
    expect(codes(out[0])).toEqual(['name_multi_codes']);
    expect(out[0].group_no).toBe(out[1].group_no);
  });

  it('flags the same name under different types', () => {
    const out = findInconsistentNaming([
      asset('1', { name: 'Monitor', base_asset_code: '2026-0001', category_id: 'a' }),
      asset('2', { name: 'Monitor', base_asset_code: '2026-0001', category_id: 'b' }),
    ]);
    expect(out.map(codes)).toEqual([['name_multi_types'], ['name_multi_types']]);
  });

  it('treats Arabic spelling variants as the same name', () => {
    const out = findInconsistentNaming([
      asset('1', { name: 'مكتب إداري', base_asset_code: '2026-0001' }),
      asset('2', { name: 'مكتب اداري', base_asset_code: '2026-0002' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('flags an embedded old code and compares the cleaned name', () => {
    const out = findInconsistentNaming([
      asset('1', { name: 'Laptop 2025-0038-13@HQ', base_asset_code: '2026-0001' }),
      asset('2', { name: 'Laptop', base_asset_code: '2026-0001' }),
    ]);
    expect(out.map((f) => f.item.id)).toEqual(['1']);
    expect(codes(out[0])).toEqual(['name_embedded_code']);
    expect(out[0].group_no).toBeUndefined();
  });

  it('is quiet for consistent data', () => {
    expect(findInconsistentNaming([
      asset('1', { name: 'Laptop', base_asset_code: '2026-0001' }),
      asset('2', { name: 'Laptop', base_asset_code: '2026-0001' }),
    ])).toEqual([]);
  });
});

describe('findAnomalies', () => {
  const peers = ['10', '11', '12', '13', '14'].map((id) => asset(id, { purchase_price: 100 }));

  it('flags zero / negative quantity and negative price', () => {
    const out = findAnomalies([asset('1', { quantity: 0 }), asset('2', { quantity: -3 }), asset('3', { purchase_price: -5 })], NOW);
    expect(out.map(codes)).toEqual([['qty_not_positive'], ['qty_not_positive'], ['price_negative']]);
  });

  it('flags a price far above the median of the same type', () => {
    const out = findAnomalies([...peers, asset('1', { purchase_price: 900 })], NOW);
    expect(out.map((f) => f.item.id)).toEqual(['1']);
    expect(codes(out[0])).toEqual(['price_high']);
    expect(out[0].issues[0].params).toMatchObject({ ratio: 9, median: 100 });
  });

  it('flags a price far below the median, but not an ordinary one', () => {
    const out = findAnomalies([...peers, asset('1', { purchase_price: 5 }), asset('2', { purchase_price: 300 })], NOW);
    expect(out.map((f) => f.item.id)).toEqual(['1']);
    expect(codes(out[0])).toEqual(['price_low']);
  });

  it('does not judge prices when the type has too few priced assets', () => {
    const few = [asset('1', { purchase_price: 100 }), asset('2', { purchase_price: 100 }), asset('3', { purchase_price: 5000 })];
    expect(findAnomalies(few, NOW)).toEqual([]);
  });

  it('compares only within the same type', () => {
    const other = ['20', '21', '22', '23', '24'].map((id) => asset(id, { category_id: 'cat-2', purchase_price: 1000 }));
    expect(findAnomalies([...peers, ...other, asset('1', { category_id: 'cat-2', purchase_price: 1200 })], NOW)).toEqual([]);
  });

  it('flags future purchase dates and dates before 1990', () => {
    const out = findAnomalies([
      asset('1', { purchase_date: '2027-01-01' }),
      asset('2', { purchase_date: '1985-05-05' }),
      asset('3', { purchase_date: '2026-06-01' }),
      asset('4', { purchase_date: '1990-01-01' }),
    ], NOW);
    expect(out.map((f) => [f.item.id, codes(f)[0]])).toEqual([['1', 'date_future'], ['2', 'date_too_old']]);
  });

  it('median handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('findStale', () => {
  const day = 24 * 3600 * 1000;
  const ago = (d: number) => new Date(NOW.getTime() - d * day).toISOString();

  it('uses the latest inventory or movement date and the day limit', () => {
    const assets = [asset('1'), asset('2'), asset('3')];
    const out = findStale(assets, [
      { asset_id: '1', at: ago(400), source: 'inventory' },
      { asset_id: '1', at: ago(100), source: 'movement' },
      { asset_id: '2', at: ago(500), source: 'inventory' },
    ], NOW, 365);
    // 1 was seen 100 days ago (fresh); 2 is stale; 3 was never seen and was created long ago
    expect(out.map((f) => f.item.asset.id)).toEqual(['3', '2']);
    expect(out.find((f) => f.item.asset.id === '2')!.item).toMatchObject({ source: 'inventory', days_since: 500 });
    expect(out.find((f) => f.item.asset.id === '3')!.item.source).toBe('created');
  });

  it('honours a shorter limit and sorts the oldest first', () => {
    const out = findStale([asset('1'), asset('2')], [
      { asset_id: '1', at: ago(40), source: 'inventory' },
      { asset_id: '2', at: ago(90), source: 'movement' },
    ], NOW, 30);
    expect(out.map((f) => f.item.asset.id)).toEqual(['2', '1']);
    expect(findStale([asset('1')], [{ asset_id: '1', at: ago(10), source: 'inventory' }], NOW, 30)).toEqual([]);
  });

  it('puts the stale days in the issue text', () => {
    const out = findStale([asset('1')], [{ asset_id: '1', at: ago(500), source: 'inventory' }], NOW, 365);
    expect(issueText(out[0].issues[0], 'en')).toBe('Not seen for 500 days');
    expect(issueText(out[0].issues[0], 'ar')).toContain('500');
  });
});

describe('findSuspiciousMovements', () => {
  const mv = (id: string, over: Partial<DqMovement> = {}): DqMovement => ({
    id,
    asset_id: 'a1',
    movement_type: 'transfer',
    from_location_id: 'L1',
    to_location_id: 'L2',
    from_employee_id: null,
    to_employee_id: null,
    from_status_id: null,
    to_status_id: null,
    performed_by: 'u1',
    created_at: '2026-05-01T10:00:00Z',
    status: 'approved',
    ...over,
  });

  it('flags a transfer to the same place', () => {
    const out = findSuspiciousMovements([mv('1', { from_location_id: 'L1', to_location_id: 'L1' })]);
    expect(out.map(codes)).toEqual([['mv_same_place']]);
  });

  it('does not flag a same-place change of custodian or status', () => {
    expect(findSuspiciousMovements([
      mv('1', { from_location_id: 'L1', to_location_id: 'L1', to_employee_id: 'e1' }),
      mv('2', { from_location_id: 'L1', to_location_id: 'L1', to_status_id: 's1' }),
    ])).toEqual([]);
  });

  it('flags there-and-back within 24 hours, both rows with one group', () => {
    const out = findSuspiciousMovements([
      mv('1', { from_location_id: 'L1', to_location_id: 'L2', created_at: '2026-05-01T10:00:00Z' }),
      mv('2', { from_location_id: 'L2', to_location_id: 'L1', created_at: '2026-05-01T20:00:00Z' }),
    ]);
    expect(out.map((f) => f.item.id)).toEqual(['1', '2']);
    expect(out[0].group_no).toBe(out[1].group_no);
    expect(codes(out[0])).toEqual(['mv_back_forth']);
  });

  it('ignores a return after more than 24 hours and a different asset', () => {
    expect(findSuspiciousMovements([
      mv('1', { created_at: '2026-05-01T10:00:00Z' }),
      mv('2', { from_location_id: 'L2', to_location_id: 'L1', created_at: '2026-05-02T11:00:00Z' }),
      mv('3', { asset_id: 'a2', from_location_id: 'L2', to_location_id: 'L1', created_at: '2026-05-01T11:00:00Z' }),
    ])).toEqual([]);
  });

  it('flags bulk moves by one user in a short window', () => {
    const many = Array.from({ length: 22 }, (_, i) => mv(`b${i}`, {
      asset_id: `x${i}`, created_at: new Date(Date.UTC(2026, 4, 3, 9, 0, i * 10)).toISOString(),
    }));
    const slow = Array.from({ length: 22 }, (_, i) => mv(`s${i}`, {
      asset_id: `y${i}`, performed_by: 'u2', created_at: new Date(Date.UTC(2026, 4, 4, 9, i * 30, 0)).toISOString(),
    }));
    const out = findSuspiciousMovements([...many, ...slow]);
    expect(out).toHaveLength(22);
    expect(out.every((f) => codes(f).join() === 'mv_bulk')).toBe(true);
    expect(out[0].issues[0].params).toMatchObject({ count: 22, minutes: 10 });
  });

  it('ignores rejected movements', () => {
    expect(findSuspiciousMovements([mv('1', { from_location_id: 'L1', to_location_id: 'L1', status: 'rejected' })])).toEqual([]);
  });
});

describe('issue text', () => {
  it('is translated and fills parameters', () => {
    const issue = { code: 'dup_serial' as const, params: { value: 'SN-1' } };
    expect(issueText(issue, 'en')).toBe('Duplicate serial number (SN-1)');
    expect(issueText(issue, 'ar')).toBe('الرقم التسلسلي مكرر (SN-1)');
    expect(issuesText([{ code: 'missing_location' }, { code: 'missing_type' }], 'en')).toBe('No location; No type');
  });
});

describe('data-quality report wiring', () => {
  it('every data-quality resource has a title and catalog columns that all have labels', () => {
    for (const resource of DQ_RESOURCES) {
      expect(RESOURCE_TITLES[resource].ar).toBeTruthy();
      expect(RESOURCE_TITLES[resource].en).toBeTruthy();
      const entry = REPORT_CATALOG[resource]!;
      expect(entry).toBeDefined();
      for (const key of entry.defaults) expect(entry.columns).toContain(key);
      for (const key of entry.columns) expect(COLUMN_LABELS[key]).toBeDefined();
      expect(entry.columns).toContain('issue');
    }
    expect(isDataQualityResource('dq-stale')).toBe(true);
    expect(isDataQualityResource('assets')).toBe(false);
  });

  it('the provider binds the tenant first and returns translated issue rows', async () => {
    const order: string[] = [];
    const dupes = [
      { id: 'a1', name: 'X', base_asset_code: '2026-0001', category_id: null, location_id: null, status_id: null, employee_id: null, quantity: 1, purchase_price: 5, purchase_date: null, serial_number: 'SN-9', barcode: null, created_at: null },
      { id: 'a2', name: 'Y', base_asset_code: '2026-0002', category_id: null, location_id: null, status_id: null, employee_id: null, quantity: 1, purchase_price: 5, purchase_date: null, serial_number: 'sn9', barcode: null, created_at: null },
    ];
    const db = {
      setTenant: jest.fn(async () => { order.push('setTenant'); }),
      query: jest.fn(async (sql: string) => {
        order.push('query');
        return /FROM assets WHERE tenant_id = \$1 AND is_active/.test(sql) ? { rows: dupes, rowCount: 2 } : { rows: [], rowCount: 0 };
      }),
    };
    const provider = new DataQualityExportProvider('dq-duplicate-ids', new DataQualityService(db as never));
    const en = await provider.getData('t1', { meta: { lang: 'en' } } as never);
    expect(order[0]).toBe('setTenant');
    expect(en.total).toBe(2);
    expect((en.rows[0] as Record<string, unknown>).issue).toBe('Duplicate serial number (SN-9)');
    const ar = await provider.getData('t1', {} as never);
    expect((ar.rows[0] as Record<string, unknown>).issue).toContain('الرقم التسلسلي مكرر');
    const summary = await new DataQualityService(db as never).summary('t1');
    expect(summary['dq-duplicate-ids']).toBe(2);
    expect(summary['dq-movements']).toBe(0);
  });
});

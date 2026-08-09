import { describe, it, expect } from 'vitest';
import {
  mapAssetSummary,
  mapPagedAssets,
  mapAuditEvents,
  mapAssetMovements,
  mapLifecycleTransitions,
  mapAnalytics,
  buildNameLookup,
  resolveName,
} from './index';

const UUID = '1708a6fe-cfb9-429d-902a-55d4f73d07f5';

describe('mapAssetSummary', () => {
  it('maps fields + name resolution', () => {
    const names = buildNameLookup(
      [{ id: 'cat1', name: 'IT' }],
      [{ id: 'loc1', name: 'HQ' }],
      [{ id: 'emp1', name: 'John' }],
      [],
    );
    const a = mapAssetSummary({ id: 'a1', name: 'Laptop', full_asset_code: 'X', base_asset_code: 'B', quantity: '3', category_id: 'cat1', location_id: 'loc1', employee_id: 'emp1', purchase_price: '100', is_active: true }, names)!;
    expect(a.id).toBe('a1');
    expect(a.quantity).toBe(3);
    expect(a._categoryName).toBe('IT');
    expect(a._locationName).toBe('HQ');
    expect(a._employeeName).toBe('John');
  });

  it('falls back for unknown/null refs (no UUID leak)', () => {
    const a = mapAssetSummary({ id: 'a1', name: 'X', location_id: UUID, purchase_price: '0' })!;
    expect(a._locationName).toBe('—');
    expect(a._employeeName).toBe('—');
  });

  it('returns null for invalid input', () => {
    expect(mapAssetSummary(null)).toBeNull();
    expect(mapAssetSummary('junk')).toBeNull();
  });
});

describe('mapPagedAssets', () => {
  it('handles array response', () => {
    const res = mapPagedAssets([{ id: '1', name: 'A', full_asset_code: 'C', base_asset_code: 'B', quantity: 1, purchase_price: '1', is_active: true }]);
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });
  it('handles wrapped response with total', () => {
    const res = mapPagedAssets({ items: [{ id: '1', name: 'A', full_asset_code: 'C', base_asset_code: 'B', quantity: 1, purchase_price: '1', is_active: true }], total: 42 });
    expect(res.total).toBe(42);
  });
  it('empty response -> empty items', () => {
    expect(mapPagedAssets(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe('mapAuditEvents', () => {
  it('handles array and wrapped responses', () => {
    expect(mapAuditEvents([{ id: '1', action_type: 'ASSET_CREATED', entity: 'asset', entity_id: 'x', created_at: 't' }])).toHaveLength(1);
    expect(mapAuditEvents({ items: [{ id: '2', action_type: 'X', entity: 'a', entity_id: 'y', created_at: 't' }] })).toHaveLength(1);
  });
  it('handles empty and malformed', () => {
    expect(mapAuditEvents(null)).toEqual([]);
    expect(mapAuditEvents({})).toEqual([]);
  });
});

describe('mapAssetMovements', () => {
  it('maps array response', () => {
    const mv = mapAssetMovements([{ id: 'm1', asset_id: 'a', movement_type: 'transfer', status: 'approved', created_at: 't' }]);
    expect(mv).toHaveLength(1);
    expect(mv[0].movement_type).toBe('transfer');
  });
  it('empty -> []', () => {
    expect(mapAssetMovements(undefined)).toEqual([]);
  });
});

describe('mapLifecycleTransitions', () => {
  it('maps wrapped transitions', () => {
    const t = mapLifecycleTransitions({ assetId: 'a', state: 'active', allowedTransitions: [{ from: 'active', to: 'assigned' }] });
    expect(t?.allowedTransitions).toHaveLength(1);
    expect(t?.allowedTransitions[0].to).toBe('assigned');
  });
  it('null for invalid', () => {
    expect(mapLifecycleTransitions(null)).toBeNull();
  });
});

describe('mapAnalytics', () => {
  it('maps buckets and counts', () => {
    const a = mapAnalytics({ total_assets: '10', active_assets: 8, by_category: [{ name: 'IT', count: '5' }], by_location: [], lifecycle_distribution: [{ state: 'active', count: 8 }] });
    expect(a.total_assets).toBe(10);
    expect(a.active_assets).toBe(8);
    expect(a.by_category[0].count).toBe(5);
    expect(a.lifecycle_distribution[0].state).toBe('active');
  });
  it('lifecycle buckets read backend `state` (live contract) with `name` fallback', () => {
    const a = mapAnalytics({ lifecycle_distribution: [{ state: 'assigned', count: 11 }, { name: 'registered', count: 5 }] });
    expect(a.lifecycle_distribution.map((b) => b.state)).toEqual(['assigned', 'registered']);
    expect(a.lifecycle_distribution.every((b) => b.state !== '')).toBe(true);
  });
  it('empty -> zeroed', () => {
    const a = mapAnalytics(undefined);
    expect(a.total_assets).toBe(0);
    expect(a.by_category).toEqual([]);
  });
});

describe('resolveName', () => {
  it('resolves or falls back', () => {
    const names = buildNameLookup([{ id: 'c1', name: 'IT' }], [], [], []);
    expect(resolveName(names, 'categories', 'c1')).toBe('IT');
    expect(resolveName(names, 'categories', UUID)).toBe('—');
    expect(resolveName(names, 'categories', null)).toBe('—');
  });
});

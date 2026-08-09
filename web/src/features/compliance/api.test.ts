/**
 * Slice 4 compliance mapping tests — locked against live QA payloads.
 */
import { describe, expect, it } from 'vitest';
import { mapHealth, mapIntegrity } from './api';

const LIVE_HEALTH = {
  tenant_id: 't1',
  checks: [
    { check: 'assets_without_location', status: 'OK', count: 0 },
    { check: 'assets_without_owner', status: 'WARNING', count: 6 },
  ],
};

const LIVE_INTEGRITY = {
  tenant_id: 't1',
  score: 0,
  checks: [{ check: 'orphan_asset', status: 'WARNING', count: 6, weight: 30 }],
};

describe('mapHealth', () => {
  it('maps live checks with strict OK/WARNING status', () => {
    const h = mapHealth(LIVE_HEALTH);
    expect(h.checks).toHaveLength(2);
    expect(h.checks[0]).toEqual({ check: 'assets_without_location', status: 'OK', count: 0 });
    expect(h.checks[1].status).toBe('WARNING');
  });
});

describe('mapIntegrity', () => {
  it('maps score + weighted checks', () => {
    const i = mapIntegrity(LIVE_INTEGRITY);
    expect(i.score).toBe(0);
    expect(i.checks[0]).toEqual({ check: 'orphan_asset', status: 'WARNING', count: 6, weight: 30 });
  });

  it('empty payload stays honest (score 0, no checks)', () => {
    const i = mapIntegrity(undefined);
    expect(i.score).toBe(0);
    expect(i.checks).toEqual([]);
  });
});

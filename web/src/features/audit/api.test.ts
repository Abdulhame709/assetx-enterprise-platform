/**
 * Slice 4 mapping tests — locked against the LIVE backend shapes observed in QA.
 */
import { describe, expect, it } from 'vitest';
import { mapPagedAudit, mapAuditRow } from './api';

const LIVE_EVENT = {
  id: '63a903bf-be83-44d8-a9dc-5db9c7a5f92e',
  tenant_id: '00000000-0000-4000-8000-000000000001',
  user_id: 'e3ef402b-38bd-4053-b53f-2dac0c844e27',
  action_type: 'PERMISSION_GRANTED',
  table_name: 'permission',
  record_id: 'AuditController',
  details: { method: 'GET', reason: 'Permission granted', endpoint: '/audit/events', resource: 'AuditController', permission: 'audit.view' },
  ip_address: null,
  device_fingerprint: null,
  geo: null,
  user_agent: null,
  created_at: '2026-08-09T20:54:09.547Z',
};

describe('mapPagedAudit (live {items,total} envelope)', () => {
  it('maps items + total and preserves nullable fields honestly', () => {
    const p = mapPagedAudit({ items: [LIVE_EVENT], total: 34358 });
    expect(p.total).toBe(34358);
    expect(p.items).toHaveLength(1);
    const r = p.items[0];
    expect(r.action_type).toBe('PERMISSION_GRANTED');
    expect(r.table_name).toBe('permission');
    expect(r.record_id).toBe('AuditController');
    expect(r.details?.endpoint).toBe('/audit/events');
    expect(r.ip_address).toBeNull();
    expect(r.user_agent).toBeNull();
  });

  it('tolerates bare arrays and empty payloads', () => {
    expect(mapPagedAudit([LIVE_EVENT]).total).toBe(1);
    expect(mapPagedAudit(null).items).toEqual([]);
    expect(mapPagedAudit(undefined).total).toBe(0);
  });

  it('drops malformed details without inventing data', () => {
    const r = mapAuditRow({ id: 'x', action_type: 'API_REQUEST', details: 'broken', ip_address: 42 });
    expect(r.details).toBeNull();
    expect(r.ip_address).toBe('42');
    expect(r.user_id).toBeNull();
  });
});

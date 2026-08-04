/**
 * Integration tests — Saved Searches (ADR-011, Phase 11.4).
 * CRUD, per-user isolation, tenant isolation, limits, validation, audit.
 * Real PostgreSQL (PGlite) + RLS.
 */
import { createHarness, Harness } from './support/db.harness';
import { AUDIT_EVENTS } from '../src/core/constants/audit-events';

describe('Saved Searches — integration (ADR-011)', () => {
  let h: Harness;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    h = await createHarness();
    const a = await h.auth.register({ tenantId: h.tenantA, username: 'ss_userA', password: 'Pass123456' });
    userA = a.user.id;
    const b = await h.auth.register({ tenantId: h.tenantA, username: 'ss_userB', password: 'Pass123456' });
    userB = b.user.id;
  });

  it('creates a saved search and lists it', async () => {
    const created = await h.savedSearches.create(h.tenantA, userA, {
      name: 'High-value', resource: 'assets', filters: { price_from: 50000 },
    });
    expect(created.id).toBeDefined();
    expect(created.resource).toBe('assets');
    const list = await h.savedSearches.list(h.tenantA, userA);
    expect(list.some((s) => s.name === 'High-value')).toBe(true);
  });

  it('per-user isolation — user A cannot see user B saved searches', async () => {
    await h.savedSearches.create(h.tenantA, userB, { name: 'B-secret', resource: 'audit', filters: {} });
    const aList = await h.savedSearches.list(h.tenantA, userA);
    expect(aList.some((s) => s.name === 'B-secret')).toBe(false);
  });

  it('tenant isolation — tenant A saved search not visible from tenant B', async () => {
    const ub = await h.auth.register({ tenantId: h.tenantB, username: 'ss_userB2', password: 'Pass123456' });
    const bList = await h.savedSearches.list(h.tenantB, ub.user.id);
    expect(bList).toHaveLength(0); // none in tenant B
    // tenant A user still has their saved searches
    const aList = await h.savedSearches.list(h.tenantA, userA);
    expect(aList.length).toBeGreaterThanOrEqual(1);
  });

  it('duplicate name → CONFLICT', async () => {
    await h.savedSearches.create(h.tenantA, userA, { name: 'dup', resource: 'assets', filters: {} });
    await expect(
      h.savedSearches.create(h.tenantA, userA, { name: 'dup', resource: 'assets', filters: {} }),
    ).rejects.toThrow('SAVED_SEARCH_NAME_EXISTS');
  });

  it('update name/filters and delete', async () => {
    const s = await h.savedSearches.create(h.tenantA, userA, { name: 'tmp', resource: 'assets', filters: {} });
    const updated = await h.savedSearches.update(h.tenantA, userA, s.id, { name: 'renamed' });
    expect(updated!.name).toBe('renamed');
    await h.savedSearches.remove(h.tenantA, userA, s.id);
    const list = await h.savedSearches.list(h.tenantA, userA);
    expect(list.some((x) => x.id === s.id)).toBe(false);
  });

  it('max 50 per user enforced (LIMIT_EXCEEDED)', async () => {
    const fresh = await h.auth.register({ tenantId: h.tenantA, username: 'ss_limit', password: 'Pass123456' });
    for (let i = 0; i < 50; i++) {
      await h.savedSearches.create(h.tenantA, fresh.user.id, { name: `lim${i}`, resource: 'assets', filters: {} });
    }
    await expect(
      h.savedSearches.create(h.tenantA, fresh.user.id, { name: 'overflow', resource: 'assets', filters: {} }),
    ).rejects.toThrow('SAVED_SEARCH_LIMIT_EXCEEDED');
  });

  it('execution returns live filters (audited)', async () => {
    const s = await h.savedSearches.create(h.tenantA, userA, { name: 'runme', resource: 'movements', filters: { status: 'pending' } });
    const exec = await h.savedSearches.getForExecution(h.tenantA, userA, s.id);
    expect(exec!.resource).toBe('movements');
    expect(exec!.filters.status).toBe('pending');
    const events = await h.audit.query({ tenant_id: h.tenantA, action: AUDIT_EVENTS.SAVED_SEARCH_EXECUTED });
    expect(events.items.length).toBeGreaterThanOrEqual(1);
  });
});

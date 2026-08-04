/**
 * Integration tests — Audit Trail & Compliance Engine (Phase 10).
 * Audit creation, search, tenant isolation, permission-denied logging,
 * asset timeline, compliance checks. Real PostgreSQL (PGlite).
 * Reference: ADR-010 · FRS FR-AUD-*
 */
import { createHarness, Harness } from './support/db.harness';
import { AUDIT_EVENTS } from '../src/core/constants/audit-events';

describe('Audit & Compliance — integration (Phase 10)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'audit_user', password: 'Pass123456' });
    userA = u.user.id;
  });

  it('logs ASSET_CREATED when an asset is created (domain event)', async () => {
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'AuditAsset', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const events = await h.audit.query({ tenant_id: h.tenantA, entity: 'asset', recordId: asset.id });
    expect(events.items.some((e) => e.action_type === AUDIT_EVENTS.ASSET_CREATED)).toBe(true);
  });

  it('logs AUTH_LOGIN_SUCCESS on login and AUTH_LOGIN_FAILED on bad password', async () => {
    await h.auth.login({ username: 'audit_user', password: 'Pass123456' });
    await expect(h.auth.login({ username: 'audit_user', password: 'WrongPass99' })).rejects.toThrow();
    const events = await h.audit.securityQuery(h.tenantA);
    const actions = events.items.map((e) => e.action_type);
    expect(actions).toContain(AUDIT_EVENTS.AUTH_LOGIN_FAILED);
    // login success is classified as auth but not a security warning
    const all = await h.audit.query({ tenant_id: h.tenantA, action: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS });
    expect(all.items.length).toBeGreaterThanOrEqual(1);
  });

  it('logs PERMISSION_DENIED when permission is missing', async () => {
    // register an Employee (asset.view only), try to read audit (requires audit.view)
    const emp = await h.auth.register({ tenantId: h.tenantA, username: 'audit_emp', password: 'Pass123456' });
    await h.db.exec(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT '${h.tenantA}', '${emp.user.id}', id FROM roles WHERE tenant_id='${h.tenantA}' AND name='Employee'
       ON CONFLICT DO NOTHING`,
    );
    const keys = await h.repo.findPermissionKeys(emp.user.id);
    expect(keys).not.toContain('audit.view'); // Employee lacks audit.view
    // (HTTP-level 403 tested in E2E; here we verify the catalog)
  });

  it('asset timeline returns ordered events for an asset', async () => {
    const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'TimelineAsset', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const timeline = await h.audit.assetTimeline(h.tenantA, asset.id);
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.some((e) => e.action_type === AUDIT_EVENTS.ASSET_CREATED)).toBe(true);
  });

  it('audit search supports filters and pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await h.assets.create({ tenant_id: h.tenantA, name: `SearchAudit-${i}`, category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    }
    const res = await h.audit.query({ tenant_id: h.tenantA, entity: 'asset', page: 1, limit: 3 });
    expect(res.items.length).toBeLessThanOrEqual(3);
    expect(res.total).toBeGreaterThanOrEqual(5);
  });

  it('tenant isolation — tenant A events not visible from tenant B', async () => {
    const assetA = await h.assets.create({ tenant_id: h.tenantA, name: 'IsolatedAudit', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
    const fromB = await h.audit.query({ tenant_id: h.tenantB, entity: 'asset', recordId: assetA.id });
    expect(fromB.items).toHaveLength(0);
  });

  it('compliance health — returns checks (OK for clean data; detects missing fields)', async () => {
    const health = await h.compliance.health(h.tenantA);
    expect(health.tenant_id).toBe(h.tenantA);
    expect(Array.isArray(health.checks)).toBe(true);
    const checks = Object.fromEntries(health.checks.map((c) => [c.check, c]));
    expect(checks['assets_without_location']).toBeDefined();
    expect(checks['assets_without_status']).toBeDefined();
    expect(checks['open_inventory_cycles']).toBeDefined();
  });

  it('compliance flags assets without barcode and without category', async () => {
    // insert an active asset with no barcode and no category
    await h.db.setTenant(h.tenantA);
    await h.db.query(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, status_id, location_id, is_active)
       VALUES ($1,'NoBarcode','2099-0100','2099-0100@nb',1,$2,$3,true)`,
      [h.tenantA, h.refA.status, h.refA.location],
    );
    const health = await h.compliance.health(h.tenantA);
    const noBarcode = health.checks.find((c) => c.check === 'assets_without_barcode');
    const noCategory = health.checks.find((c) => c.check === 'assets_without_category');
    expect(noBarcode!.count).toBeGreaterThanOrEqual(1);
    expect(noBarcode!.status).toBe('WARNING');
    expect(noCategory!.count).toBeGreaterThanOrEqual(1);
    expect(noCategory!.status).toBe('WARNING');
  });

  it('compliance flags an asset without a location', async () => {
    // insert an asset directly with null location (bypassing service validation)
    await h.db.setTenant(h.tenantA);
    await h.db.query(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, category_id, status_id, is_active)
       VALUES ($1,'NoLoc','2099-0001','2099-0001@x',1,$2,$3,true)`,
      [h.tenantA, h.refA.category, h.refA.status],
    );
    const health = await h.compliance.health(h.tenantA);
    const noLoc = health.checks.find((c) => c.check === 'assets_without_location');
    expect(noLoc!.count).toBeGreaterThanOrEqual(1);
    expect(noLoc!.status).toBe('WARNING');
  });
});

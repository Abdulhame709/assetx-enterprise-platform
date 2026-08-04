/**
 * Tests — Asset Lifecycle State Machine (Task L1).
 * Derived-state intelligence only: no persistence, no events, no workflow
 * execution, no API. Covers derivation priority, transition validation and
 * evaluation, plus an integration path that builds a snapshot from a real
 * asset via AssetLifecycleSnapshotAdapter.
 * Reference: Task L1 — Epic L (Asset Lifecycle Management).
 */
import { createHarness, Harness } from './support/db.harness';
import { deriveLifecycleState } from '../src/application/lifecycle-state-machine.service';
import {
  AssetLifecycleSnapshot,
  LifecycleStateId,
  LIFECYCLE_ERRORS,
} from '../src/core/entities/lifecycle.entity';

describe('Asset Lifecycle State Machine — derived-state intelligence (Task L1)', () => {
  let h: Harness;
  let userA: string;

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'lifec_user', password: 'Pass123456' });
    userA = u.user.id;
  });

  describe('deriveLifecycleState — priority order', () => {
    const snap = (p: Partial<AssetLifecycleSnapshot>): AssetLifecycleSnapshot => ({
      isActive: true,
      employeeId: null,
      latestMovementType: null,
      ...p,
    });

    it('disposed — inactive + disposal movement', () => {
      expect(deriveLifecycleState(snap({ isActive: false, latestMovementType: 'disposal' }))).toBe('disposed');
    });
    it('archived — any other inactive asset', () => {
      expect(deriveLifecycleState(snap({ isActive: false, latestMovementType: 'retirement' }))).toBe('archived');
      expect(deriveLifecycleState(snap({ isActive: false, latestMovementType: null }))).toBe('archived');
    });
    it('in_maintenance — maintenance_return movement', () => {
      expect(deriveLifecycleState(snap({ latestMovementType: 'maintenance_return' }))).toBe('in_maintenance');
    });
    it('transferred — approved transfer', () => {
      expect(deriveLifecycleState(snap({ latestMovementType: 'transfer' }))).toBe('transferred');
    });
    it('assigned — employee custody (transferred takes precedence)', () => {
      expect(deriveLifecycleState(snap({ latestMovementType: 'assignment', employeeId: 'emp-1' }))).toBe('assigned');
    });
    it('registered — active, never moved', () => {
      expect(deriveLifecycleState(snap({}))).toBe('registered');
    });
    it('active — active with movement history not covered above', () => {
      expect(deriveLifecycleState(snap({ latestMovementType: 'return' }))).toBe('active');
    });
    it('every derivation yields a valid LifecycleStateId (draft is the defensive fallback)', () => {
      // 'draft' is the final default branch in the derivation; the derived result
      // is always type-valid even for unexpected signal combinations.
      const ids: LifecycleStateId[] = [
        deriveLifecycleState(snap({ isActive: false, latestMovementType: 'disposal' })),
        deriveLifecycleState(snap({ isActive: true, latestMovementType: null })),
      ];
      expect(ids.every((id) => ['draft', 'registered', 'active', 'assigned', 'in_maintenance', 'transferred', 'disposed', 'archived'].includes(id))).toBe(true);
    });
  });

  describe('validateTransition — allowed vs rejected', () => {
    it('allows valid edges', () => {
      expect(h.lifecycle.validateTransition('draft', 'registered').allowed).toBe(true);
      expect(h.lifecycle.validateTransition('registered', 'active').allowed).toBe(true);
      expect(h.lifecycle.validateTransition('active', 'assigned').allowed).toBe(true);
      expect(h.lifecycle.validateTransition('in_maintenance', 'active').allowed).toBe(true);
    });

    it('rejects invalid edges', () => {
      const d = h.lifecycle.validateTransition('draft', 'active');
      expect(d.allowed).toBe(false);
      expect(d.reason).toBe(LIFECYCLE_ERRORS.INVALID_TRANSITION);
      expect(h.lifecycle.validateTransition('registered', 'assigned').allowed).toBe(false);
    });

    it('terminal states have no outgoing transitions', () => {
      expect(h.lifecycle.getAllowedTransitions('disposed')).toHaveLength(0);
      expect(h.lifecycle.getAllowedTransitions('archived')).toHaveLength(0);
      expect(h.lifecycle.validateTransition('disposed', 'active').allowed).toBe(false);
      expect(h.lifecycle.validateTransition('archived', 'registered').allowed).toBe(false);
    });
  });

  describe('evaluateTransition — derive + evaluate target', () => {
    it('returns resultingState for an allowed transition', () => {
      const res = h.lifecycle.evaluateTransition(
        { isActive: true, employeeId: null, latestMovementType: null }, 'active',
      );
      expect(res.allowed).toBe(true);
      expect(res.from).toBe('registered');
      expect(res.to).toBe('active');
      expect(res.resultingState).toBe('active');
    });

    it('rejects an invalid transition (no resultingState)', () => {
      const res = h.lifecycle.evaluateTransition(
        { isActive: false, employeeId: null, latestMovementType: 'disposal' }, 'active',
      );
      expect(res.allowed).toBe(false);
      expect(res.from).toBe('disposed');
      expect(res.resultingState).toBeUndefined();
    });
  });

  describe('getState / getStates', () => {
    it('returns the 8 reference states', () => {
      const ids = h.lifecycle.getStates().map((s) => s.id);
      expect(ids).toEqual(['draft', 'registered', 'active', 'assigned', 'in_maintenance', 'transferred', 'disposed', 'archived']);
      expect(h.lifecycle.getState('disposed').terminal).toBe(true);
    });
    it('throws for an unknown state', () => {
      expect(() => h.lifecycle.getState('unknown' as LifecycleStateId)).toThrow('UNKNOWN_LIFECYCLE_STATE');
    });
  });

  describe('integration — snapshot from a real asset via adapter', () => {
    it('fresh active asset → registered', async () => {
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'Lifecycle A', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      const snapshot = await h.lifecycleAdapter.fromAsset(asset, h.tenantA);
      expect(h.lifecycle.getCurrentState(snapshot)).toBe('registered');
    });

    it('approved disposal → disposed; terminal cannot reactivate', async () => {
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'Lifecycle B', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      const mv = await h.movements.dispose(h.tenantA, asset.id, userA, 'eol');
      await h.movements.approve(mv.id, h.tenantA, userA);

      // disposed asset is inactive → read directly from DB (findById filters active)
      const row = await h.db.query<{ id: string; is_active: boolean; employee_id: string | null }>(
        `SELECT id, is_active, employee_id FROM assets WHERE id = $1 AND tenant_id = $2`, [asset.id, h.tenantA],
      );
      const snapshot = await h.lifecycleAdapter.fromAsset(row.rows[0], h.tenantA);
      expect(h.lifecycle.getCurrentState(snapshot)).toBe('disposed');
      // existing asset mutation happened through the existing service (no interference)
      expect(row.rows[0].is_active).toBe(false);
      // evaluate reactivation from the real disposed asset → rejected
      const evalRes = h.lifecycle.evaluateTransition(snapshot, 'active');
      expect(evalRes.allowed).toBe(false);
      expect(evalRes.resultingState).toBeUndefined();
    });

    it('approved assignment → assigned', async () => {
      const emp = await h.employees.create({ tenant_id: h.tenantA, name: 'Lifecycle Employee' });
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'Lifecycle C', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: asset.id, movement_type: 'assignment', to_employee_id: emp.id, performed_by: userA });
      await h.movements.approve(mv.id, h.tenantA, userA);

      const reloaded = await h.assets.getById(asset.id, h.tenantA);
      const snapshot = await h.lifecycleAdapter.fromAsset(reloaded!, h.tenantA);
      expect(h.lifecycle.getCurrentState(snapshot)).toBe('assigned');
    });
  });
});

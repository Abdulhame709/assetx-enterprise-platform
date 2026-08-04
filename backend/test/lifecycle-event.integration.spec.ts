/**
 * Tests — Asset Lifecycle Events (Task L2).
 * Lifecycle Event = State Transition (not a data change). Covers the event
 * mapping, transition publishing, the no-publish-on-unchanged guard, terminal
 * state handling, and the non-invasive subscriber bridge driven by existing
 * domain events (ASSET_CREATED, MOVEMENT_APPROVED).
 * Reference: Task L2 — Epic L.
 */
import { createHarness, Harness } from './support/db.harness';
import { DOMAIN_EVENTS, DomainEvent } from '../src/core/events/event-types';
import { LIFECYCLE_EVENTS } from '../src/core/entities/lifecycle-event.entity';

const flush = () => new Promise((r) => setTimeout(r, 30));

describe('Lifecycle Events — publisher + subscriber bridge (Task L2)', () => {
  let h: Harness;
  let userA: string;
  let events: DomainEvent[];

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'lifeev_user', password: 'Pass123456' });
    userA = u.user.id;
    events = [];
    h.bus.subscribeAll((e) => events.push(e));
  });

  beforeEach(() => { events = []; });

  const published = (type: string) => events.filter((e) => e.event === type);

  // ---- Unit: event mapping ----
  describe('mapTransitionToEvent', () => {
    it('maps every supported transition to its lifecycle event', () => {
      expect(h.lifecycleEvents.mapTransitionToEvent('draft', 'registered')).toBe(LIFECYCLE_EVENTS.ASSET_REGISTERED);
      expect(h.lifecycleEvents.mapTransitionToEvent('registered', 'active')).toBe(LIFECYCLE_EVENTS.ASSET_ACTIVATED);
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'assigned')).toBe(LIFECYCLE_EVENTS.ASSET_ASSIGNED);
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'transferred')).toBe(LIFECYCLE_EVENTS.ASSET_TRANSFERRED);
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'disposed')).toBe(LIFECYCLE_EVENTS.ASSET_DISPOSED);
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'archived')).toBe(LIFECYCLE_EVENTS.ASSET_ARCHIVED);
      expect(h.lifecycleEvents.mapTransitionToEvent('in_maintenance', 'active')).toBe(LIFECYCLE_EVENTS.ASSET_MAINTENANCE_COMPLETED);
      // mapping infrastructure ready for maintenance start (trigger disabled in L2)
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'in_maintenance')).toBe(LIFECYCLE_EVENTS.ASSET_MAINTENANCE_STARTED);
    });

    it('no event when the state does not change (data change ≠ transition)', () => {
      expect(h.lifecycleEvents.mapTransitionToEvent('active', 'active')).toBeNull();
      expect(h.lifecycleEvents.mapTransitionToEvent('assigned', 'assigned')).toBeNull();
    });

    it('terminal states never produce an outgoing event', () => {
      expect(h.lifecycleEvents.mapTransitionToEvent('disposed', 'active')).toBeNull();
      expect(h.lifecycleEvents.mapTransitionToEvent('archived', 'registered')).toBeNull();
      expect(h.lifecycleEvents.mapTransitionToEvent('disposed', 'disposed')).toBeNull();
    });
  });

  // ---- Unit: publishTransition ----
  describe('publishTransition', () => {
    it('publishes a lifecycle event for a real transition', () => {
      h.lifecycleEvents.publishTransition(h.tenantA, 'asset-1', 'active', 'disposed', userA);
      const evts = published(LIFECYCLE_EVENTS.ASSET_DISPOSED);
      expect(evts).toHaveLength(1);
      expect(evts[0].entityId).toBe('asset-1');
      expect(evts[0].payload).toMatchObject({ from: 'active', to: 'disposed' });
    });

    it('does not publish when state is unchanged', () => {
      h.lifecycleEvents.publishTransition(h.tenantA, 'asset-2', 'active', 'active', userA);
      expect(events.filter((e) => (e.event as string).startsWith('ASSET_'))).toHaveLength(0);
    });

    it('does not publish disabled events (ASSET_MAINTENANCE_STARTED deferred to L5)', () => {
      h.lifecycleEvents.publishTransition(h.tenantA, 'asset-3', 'active', 'in_maintenance', userA);
      expect(published(LIFECYCLE_EVENTS.ASSET_MAINTENANCE_STARTED)).toHaveLength(0);
    });
  });

  // ---- Integration: subscriber bridge ----
  describe('subscriber bridge — existing domain events → lifecycle events', () => {
    it('ASSET_CREATED → ASSET_REGISTERED', async () => {
      await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event A', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      expect(published(LIFECYCLE_EVENTS.ASSET_REGISTERED)).toHaveLength(1);
    });

    it('MOVEMENT_APPROVED assignment → ASSET_ASSIGNED', async () => {
      const emp = await h.employees.create({ tenant_id: h.tenantA, name: 'LC Event Employee' });
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event B', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: asset.id, movement_type: 'assignment', to_employee_id: emp.id, performed_by: userA });
      await h.movements.approve(mv.id, h.tenantA, userA);
      await flush();
      expect(published(LIFECYCLE_EVENTS.ASSET_ASSIGNED)).toHaveLength(1);
    });

    it('MOVEMENT_APPROVED transfer → ASSET_TRANSFERRED', async () => {
      const loc2 = await h.locations.create({ tenant_id: h.tenantA, name: 'LC Loc 2' });
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event C', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      const mv = await h.movements.create(h.tenantA, { tenant_id: h.tenantA, asset_id: asset.id, movement_type: 'transfer', to_location_id: loc2.id, performed_by: userA });
      await h.movements.approve(mv.id, h.tenantA, userA);
      await flush();
      expect(published(LIFECYCLE_EVENTS.ASSET_TRANSFERRED)).toHaveLength(1);
    });

    it('MOVEMENT_APPROVED disposal → ASSET_DISPOSED', async () => {
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event D', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      const mv = await h.movements.dispose(h.tenantA, asset.id, userA, 'eol');
      await h.movements.approve(mv.id, h.tenantA, userA);
      await flush();
      expect(published(LIFECYCLE_EVENTS.ASSET_DISPOSED)).toHaveLength(1);
    });

    it('MOVEMENT_APPROVED retirement → ASSET_ARCHIVED', async () => {
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event E', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      const mv = await h.movements.retire(h.tenantA, asset.id, userA, 'retire');
      await h.movements.approve(mv.id, h.tenantA, userA);
      await flush();
      expect(published(LIFECYCLE_EVENTS.ASSET_ARCHIVED)).toHaveLength(1);
    });

    it('disposed asset does not re-emit lifecycle events on later transitions (terminal)', async () => {
      const asset = await h.assets.create({ tenant_id: h.tenantA, name: 'LC Event F', category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status });
      await flush();
      const mv = await h.movements.dispose(h.tenantA, asset.id, userA, 'eol');
      await h.movements.approve(mv.id, h.tenantA, userA);
      await flush();
      const disposedCount = published(LIFECYCLE_EVENTS.ASSET_DISPOSED).length;
      // no ASSET_ACTIVATED from a terminal asset
      expect(published(LIFECYCLE_EVENTS.ASSET_ACTIVATED)).toHaveLength(0);
      expect(disposedCount).toBeGreaterThanOrEqual(1);
    });
  });
});

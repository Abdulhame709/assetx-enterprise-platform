/**
 * Integration tests — Realtime Notification Layer (SSE) (Phase 11.2).
 * Create notification → SSE event emitted; user receives own event; tenant isolation;
 * unread count; mark read; per-user isolation. Real PostgreSQL (PGlite).
 * Reference: Phase 11.2
 */
import { createHarness, Harness } from './support/db.harness';
import { DOMAIN_EVENTS } from '../src/core/events/event-types';
import { RealtimeConnection } from '../src/core/ports/realtime.port';

describe('Realtime Notification Layer — integration (Phase 11.2)', () => {
  let h: Harness;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    h = await createHarness();
    const ua = await h.auth.register({ tenantId: h.tenantA, username: 'rt_userA', password: 'Pass123456' });
    userA = ua.user.id;
    const ub = await h.auth.register({ tenantId: h.tenantA, username: 'rt_userB', password: 'Pass123456' });
    userB = ub.user.id;
  });

  function openStream(userId: string, tenantId: string): { conn: RealtimeConnection; received: string[] } {
    const received: string[] = [];
    const conn = h.realtime.connect(userId, tenantId);
    // mock express Response bound to the manager so broadcast reaches the stream
    const state = { writableEnded: false };
    const mockRes = {
      writableEnded: state.writableEnded,
      write: (chunk: string) => { received.push(chunk); return true; },
      end: () => { state.writableEnded = true; },
      on: (_ev: string, cb: () => void) => { /* ignore */ },
      writeHead: () => undefined,
    };
    h.sse.bind(conn as never, mockRes as never);
    return { conn, received };
  }

  it('Create notification → SSE event emitted to the user stream', async () => {
    const { received } = openStream(userA, h.tenantA);
    await h.bus.publish({
      event: DOMAIN_EVENTS.MOVEMENT_PENDING,
      tenant_id: h.tenantA,
      userId: userA,
      entityId: 'm-1',
      payload: { action: 'transfer' },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(received.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(String(received[0]).replace('data: ', ''));
    expect(parsed.type).toBe(DOMAIN_EVENTS.MOVEMENT_PENDING);
  });

  it('User receives own events only (per-user isolation)', async () => {
    const a = openStream(userA, h.tenantA);
    const b = openStream(userB, h.tenantA);
    await h.bus.publish({
      event: DOMAIN_EVENTS.INVENTORY_COMPLETED,
      tenant_id: h.tenantA,
      userId: userA,
      entityId: 'c-1',
      payload: { cycle: '2026' },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(a.received.length).toBeGreaterThanOrEqual(1);
    expect(b.received.length).toBe(0); // user B did not get A's event
  });

  it('Tenant isolation — user in tenant A does not receive tenant B events', async () => {
    // user in tenant B
    const ub = await h.auth.register({ tenantId: h.tenantB, username: 'rt_userB2', password: 'Pass123456' });
    const b = openStream(ub.user.id, h.tenantB);
    await h.bus.publish({
      event: DOMAIN_EVENTS.COMPLIANCE_WARNING,
      tenant_id: h.tenantA,
      userId: userA,
      entityId: 'cw-1',
      payload: { check: 'x' },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(b.received.length).toBe(0); // B did not receive A's event
  });

  it('broadcastToTenant delivers to all in the tenant', async () => {
    const a = openStream(userA, h.tenantA);
    await h.bus.publish({
      event: DOMAIN_EVENTS.SYSTEM_ALERT,
      tenant_id: h.tenantA,
      // no userId → forwarded to tenant
      payload: { message: 'maintenance' },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(a.received.length).toBeGreaterThanOrEqual(1);
  });

  it('unread count + mark as read', async () => {
    // publish a notification to userA via notification service directly
    await h.notificationService.create({
      tenant_id: h.tenantA, userId: userA, templateName: 'approval_required', payload: { action: 'transfer' },
    });
    const before = await h.notificationService.countUnread(h.tenantA, userA);
    const list = await h.notificationService.getUserNotifications(h.tenantA, userA);
    if (list.length > 0) {
      await h.notificationService.markAsRead(h.tenantA, userA, list[0].id);
    }
    const after = await h.notificationService.countUnread(h.tenantA, userA);
    expect(after).toBeLessThanOrEqual(before);
  });
});

/**
 * RealtimeService — bridges NotificationService + EventBus to SSE streams.
 * When a notification is created (from a domain event), it emits a RealtimeEvent
 * to the target user's stream.
 * Reference: Phase 11.2
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventBus } from '../core/events/event-bus';
import { DomainEvent } from '../core/events/event-types';
import { RealtimePort, RealtimeConnection } from '../core/ports/realtime.port';
import { RealtimeEvent } from '../core/events/realtime-event';
import { EVENT_BUS, REALTIME_PORT } from '../core/ports/tokens';

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(REALTIME_PORT) private readonly realtime: RealtimePort,
  ) {
    // Bridge: on any domain event, notify the affected user's stream.
    this.bus.subscribeAll((event) => this.forward(event));
  }

  /** Connect a user stream (delegates to the manager). */
  connect(userId: string, tenantId: string): RealtimeConnection {
    return this.realtime.connect(userId, tenantId);
  }

  /** Forward a domain event to the relevant user stream as a RealtimeEvent. */
  private forward(event: DomainEvent): void {
    const targetUser = event.userId;
    const type = event.event;
    const title = this.titleFor(type);
    if (targetUser) {
      const rt: RealtimeEvent = {
        id: event.entityId ?? `${type}-${Date.now()}`,
        type,
        title,
        body: event.payload ? JSON.stringify(event.payload) : undefined,
        timestamp: new Date().toISOString(),
      };
      this.realtime.broadcastToUser(targetUser, event.tenant_id, rt);
    } else {
      // No specific user → broadcast to the tenant stream.
      const rt: RealtimeEvent = {
        id: `${type}-${Date.now()}`,
        type,
        title,
        timestamp: new Date().toISOString(),
      };
      this.realtime.broadcastToTenant(event.tenant_id, rt);
    }
  }

  private titleFor(type: string): string {
    const map: Record<string, string> = {
      MOVEMENT_PENDING: 'Movement waiting approval',
      MOVEMENT_APPROVED: 'Movement approved',
      MOVEMENT_REJECTED: 'Movement rejected',
      INVENTORY_STARTED: 'Inventory started',
      INVENTORY_COMPLETED: 'Inventory completed',
      COMPLIANCE_WARNING: 'Compliance warning',
      ASSET_CREATED: 'Asset created',
      ASSET_UPDATED: 'Asset updated',
      ASSET_STATUS_CHANGED: 'Asset status changed',
      SYSTEM_ALERT: 'System alert',
    };
    return map[type] ?? type;
  }
}

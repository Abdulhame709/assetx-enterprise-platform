/**
 * LifecycleEventService — publisher of Asset Lifecycle Events (Task L2).
 * Responsibilities ONLY:
 *   Transition → Event Mapping → EventBus Publish.
 * It does NOT write to the database, does NOT mutate state, does NOT call
 * notifications, and does NOT call business services.
 * A Lifecycle Event represents a REAL state transition: if from === to there is
 * no event. Disabled events (ASSET_MAINTENANCE_STARTED) are mapped but not
 * published until a maintenance source exists (Task L5).
 * Reference: Task L2 — Epic L.
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventBus } from '../../core/events/event-bus';
import { EVENT_BUS } from '../../core/ports/tokens';
import { LifecycleStateId } from '../../core/entities/lifecycle.entity';
import {
  DISABLED_LIFECYCLE_EVENTS,
  LIFECYCLE_EVENTS,
  LifecycleEventType,
} from '../../core/entities/lifecycle-event.entity';
import { LifecycleEventPort } from '../../core/ports/lifecycle-event.port';

@Injectable()
export class LifecycleEventService implements LifecycleEventPort {
  constructor(@Inject(EVENT_BUS) private readonly bus: EventBus) {}

  mapTransitionToEvent(from: LifecycleStateId, to: LifecycleStateId): LifecycleEventType | null {
    // Guard: a Lifecycle Event is a State Transition, not a data change.
    if (from === to) return null;
    // Terminal states (disposed/archived) have no outgoing lifecycle events.
    if (from === 'disposed' || from === 'archived') return null;

    switch (to) {
      case 'disposed':
        return LIFECYCLE_EVENTS.ASSET_DISPOSED;
      case 'archived':
        return LIFECYCLE_EVENTS.ASSET_ARCHIVED;
      case 'assigned':
        return LIFECYCLE_EVENTS.ASSET_ASSIGNED;
      case 'transferred':
        return LIFECYCLE_EVENTS.ASSET_TRANSFERRED;
      case 'in_maintenance':
        return LIFECYCLE_EVENTS.ASSET_MAINTENANCE_STARTED;
      case 'registered':
        return from === 'draft' ? LIFECYCLE_EVENTS.ASSET_REGISTERED : null;
      case 'active':
        return from === 'in_maintenance'
          ? LIFECYCLE_EVENTS.ASSET_MAINTENANCE_COMPLETED
          : (from !== 'active' ? LIFECYCLE_EVENTS.ASSET_ACTIVATED : null);
      default:
        return null;
    }
  }

  publishTransition(
    tenantId: string,
    assetId: string,
    from: LifecycleStateId,
    to: LifecycleStateId,
    actor?: string | null,
  ): void {
    const type = this.mapTransitionToEvent(from, to);
    if (!type) return;
    if (DISABLED_LIFECYCLE_EVENTS.has(type)) return; // e.g. ASSET_MAINTENANCE_STARTED (deferred to L5)

    this.bus.publish({
      event: type,
      tenant_id: tenantId,
      userId: actor ?? null,
      entityId: assetId,
      payload: { asset_id: assetId, from, to },
    });
  }
}

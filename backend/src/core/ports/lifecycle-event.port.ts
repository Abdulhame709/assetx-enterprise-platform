/**
 * LifecycleEventPort — contract for publishing Asset Lifecycle Events (Task L2).
 * A Lifecycle Event maps a REAL state transition (from → to derived state) to a
 * domain event and publishes it through the EventBus. The implementation is a
 * Publisher ONLY: no DB writes, no state mutation, no notification calls, no
 * calls to business services.
 * Reference: Task L2 — Epic L.
 */
import { LifecycleStateId } from '../entities/lifecycle.entity';
import { LifecycleEventType } from '../entities/lifecycle-event.entity';

export interface LifecycleEventPort {
  /** Map a transition to a lifecycle event type (null when no event applies). */
  mapTransitionToEvent(from: LifecycleStateId, to: LifecycleStateId): LifecycleEventType | null;

  /** Publish the lifecycle event for a transition (no-op when none / disabled). */
  publishTransition(
    tenantId: string,
    assetId: string,
    from: LifecycleStateId,
    to: LifecycleStateId,
    actor?: string | null,
  ): void;
}

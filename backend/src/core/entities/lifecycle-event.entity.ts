/**
 * Lifecycle Event entities — Asset Lifecycle Events (Task L2).
 * Represents a REAL lifecycle state transition (previous → current derived
 * state). Deliberately separate from lifecycle.entity.ts (which owns only
 * LifecycleState / Snapshot / Transition validation).
 * A Lifecycle Event is a State Transition, NOT a domain data change.
 * Reference: Task L2 — Epic L.
 */

export type LifecycleEventType =
  | 'ASSET_REGISTERED'
  | 'ASSET_ACTIVATED'
  | 'ASSET_ASSIGNED'
  | 'ASSET_TRANSFERRED'
  | 'ASSET_MAINTENANCE_STARTED'
  | 'ASSET_MAINTENANCE_COMPLETED'
  | 'ASSET_DISPOSED'
  | 'ASSET_ARCHIVED';

export const LIFECYCLE_EVENTS: Record<LifecycleEventType, LifecycleEventType> = {
  ASSET_REGISTERED: 'ASSET_REGISTERED',
  ASSET_ACTIVATED: 'ASSET_ACTIVATED',
  ASSET_ASSIGNED: 'ASSET_ASSIGNED',
  ASSET_TRANSFERRED: 'ASSET_TRANSFERRED',
  ASSET_MAINTENANCE_STARTED: 'ASSET_MAINTENANCE_STARTED',
  ASSET_MAINTENANCE_COMPLETED: 'ASSET_MAINTENANCE_COMPLETED',
  ASSET_DISPOSED: 'ASSET_DISPOSED',
  ASSET_ARCHIVED: 'ASSET_ARCHIVED',
};

/**
 * Events whose trigger is NOT yet active. ASSET_MAINTENANCE_STARTED is mapped
 * (mapping infrastructure ready) but NOT emitted until a reliable maintenance
 * source exists (Task L5 — Maintenance Automation).
 */
export const DISABLED_LIFECYCLE_EVENTS: ReadonlySet<LifecycleEventType> = new Set<LifecycleEventType>([
  LIFECYCLE_EVENTS.ASSET_MAINTENANCE_STARTED,
]);

/** Payload carried on the domain event published through the EventBus. */
export interface LifecycleEventPayload {
  asset_id: string;
  from: string;
  to: string;
}

/**
 * Domain event catalog — unified event type constants (Phase 11).
 * Used by EventBus + NotificationService. Distinct from Audit events:
 * Audit = what happened; Notification = who needs to know.
 */
export const DOMAIN_EVENTS = {
  // Assets
  ASSET_CREATED: 'ASSET_CREATED',
  ASSET_UPDATED: 'ASSET_UPDATED',
  ASSET_STATUS_CHANGED: 'ASSET_STATUS_CHANGED',
  ASSET_TRANSFERRED: 'ASSET_TRANSFERRED',
  // Movements
  MOVEMENT_PENDING: 'MOVEMENT_PENDING',
  MOVEMENT_APPROVED: 'MOVEMENT_APPROVED',
  MOVEMENT_REJECTED: 'MOVEMENT_REJECTED',
  // Inventory
  INVENTORY_STARTED: 'INVENTORY_STARTED',
  INVENTORY_COMPLETED: 'INVENTORY_COMPLETED',
  // Compliance
  COMPLIANCE_WARNING: 'COMPLIANCE_WARNING',
  // Export
  EXPORT_COMPLETED: 'EXPORT_COMPLETED',
  // System
  SYSTEM_ALERT: 'SYSTEM_ALERT',
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/** A domain event payload dispatched through the EventBus. */
export interface DomainEvent {
  event: DomainEventType;
  tenant_id: string;
  /** recipient user id (optional — if null, subscribers decide) */
  userId?: string | null;
  /** the entity id the event is about (asset/movement/cycle) */
  entityId?: string | null;
  /** payload for template rendering / routing */
  payload?: Record<string, unknown>;
}

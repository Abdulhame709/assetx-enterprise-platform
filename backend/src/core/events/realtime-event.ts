/**
 * Realtime event — payload pushed over SSE to a client stream.
 * Reference: Phase 11.2 Realtime Notification Layer
 */
export interface RealtimeEvent {
  /** notification id */
  id: string;
  /** domain event type (MOVEMENT_PENDING, COMPLIANCE_WARNING, ...) */
  type: string;
  /** human-readable title */
  title: string;
  /** optional body/description */
  body?: string;
  /** ISO timestamp */
  timestamp: string;
}

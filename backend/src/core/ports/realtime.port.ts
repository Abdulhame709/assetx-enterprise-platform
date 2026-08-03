/**
 * Realtime stream port — abstract SSE connection management.
 * The SSEManager implements this; it manages connections only
 * (no DB, no permission logic, no notification creation).
 * Reference: Phase 11.2
 */
export interface RealtimeConnection {
  /** user id this stream is bound to */
  userId: string;
  /** tenant id this stream is bound to */
  tenantId: string;
  /** send a JSON payload over this stream */
  send(payload: unknown): void;
  /** close this stream */
  close(): void;
}

export interface RealtimePort {
  /** Register a new connection for a user within a tenant. */
  connect(userId: string, tenantId: string, onClose?: () => void): RealtimeConnection;
  /** Remove a connection (by its stream). */
  disconnect(conn: RealtimeConnection): void;
  /** Broadcast to all connections of a specific user. */
  broadcastToUser(userId: string, tenantId: string, payload: unknown): void;
  /** Broadcast to all connections in a tenant. */
  broadcastToTenant(tenantId: string, payload: unknown): void;
  /** Broadcast to everyone. */
  broadcast(payload: unknown): void;
}

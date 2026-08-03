/**
 * SSEManager — manages SSE connections only.
 * Responsibilities: connect, disconnect, broadcast (all / per user / per tenant).
 * Contains NO database, permission logic, or notification creation.
 * Reference: Phase 11.2 · RealtimePort
 */
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { RealtimeConnection, RealtimePort } from '../../core/ports/realtime.port';

interface ManagedConnection extends RealtimeConnection {
  res: Response;
  _onClose?: () => void;
}

@Injectable()
export class SSEManager implements RealtimePort {
  private readonly connections = new Map<string, ManagedConnection[]>();

  /** Register a user/tenant intent; bind() attaches the real response. */
  connect(userId: string, tenantId: string, onClose?: () => void): RealtimeConnection {
    const conn: ManagedConnection = {
      userId,
      tenantId,
      res: null as unknown as Response,
      _onClose: onClose,
      send: () => undefined,
      close: () => undefined,
    };
    return conn;
  }

  /** Bind a real express Response to a connection and register it. */
  bind(conn: ManagedConnection, res: Response): void {
    conn.res = res;
    conn.send = (payload: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    conn.close = () => {
      if (!res.writableEnded) res.end();
      this.disconnect(conn);
    };
    const key = this.key(conn.userId, conn.tenantId);
    const list = this.connections.get(key) ?? [];
    list.push(conn);
    this.connections.set(key, list);
    res.on('close', () => {
      this.disconnect(conn);
      conn._onClose?.();
    });
  }

  disconnect(conn: RealtimeConnection): void {
    const key = this.key(conn.userId, conn.tenantId);
    const list = this.connections.get(key);
    if (!list) return;
    const filtered = list.filter((c) => c !== conn);
    if (filtered.length === 0) this.connections.delete(key);
    else this.connections.set(key, filtered);
    try { (conn as ManagedConnection).res?.end(); } catch { /* ignore */ }
  }

  broadcast(payload: unknown): void {
    for (const list of this.connections.values()) {
      for (const c of list) c.send(payload);
    }
  }

  broadcastToTenant(tenantId: string, payload: unknown): void {
    for (const [key, list] of this.connections) {
      if (key.startsWith(`${tenantId}|`)) for (const c of list) c.send(payload);
    }
  }

  broadcastToUser(userId: string, tenantId: string, payload: unknown): void {
    const list = this.connections.get(this.key(userId, tenantId));
    if (list) for (const c of list) c.send(payload);
  }

  private key(userId: string, tenantId: string): string {
    return `${tenantId}|${userId}`;
  }
}

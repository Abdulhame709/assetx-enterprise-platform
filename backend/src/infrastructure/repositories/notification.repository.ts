/**
 * NotificationRepository — infrastructure implementation of NotificationPort.
 * Persists/retrieves notifications only; no business logic. Respects RLS.
 * Reference: Data Dictionary TB-NOTIFICATION / TB-NOTIF-TEMPLATE · Phase 11
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Notification } from '../../core/entities/notification.entity';
import { NotificationPort } from '../../core/ports/notification.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class NotificationRepository implements NotificationPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: {
    tenant_id: string;
    userId: string;
    template_id?: string | null;
    channel: string;
    payload?: Record<string, unknown> | null;
  }): Promise<Notification> {
    const { rows } = await this.db.query<Notification>(
      `INSERT INTO notifications (tenant_id, user_id, template_id, channel, status, payload)
       VALUES ($1, $2, $3, $4::notification_channel, 'queued', $5::jsonb)
       RETURNING *`,
      [input.tenant_id, input.userId, input.template_id ?? null, input.channel,
        input.payload ? JSON.stringify(input.payload) : null],
    );
    return rows[0];
  }

  async findUserNotifications(tenantId: string, userId: string): Promise<Notification[]> {
    const { rows } = await this.db.query<Notification>(
      `SELECT * FROM notifications WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [tenantId, userId],
    );
    return rows;
  }

  async markAsRead(tenantId: string, userId: string, notificationId: string): Promise<Notification | null> {
    const { rows } = await this.db.query<Notification>(
      `UPDATE notifications SET read_at = now(), status = 'read'
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3
       RETURNING *`,
      [notificationId, tenantId, userId],
    );
    return rows[0] ?? null;
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND (read_at IS NULL OR status <> 'read')`,
      [tenantId, userId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async findTemplate(tenantId: string, name: string): Promise<{ id: string; subject: string | null; body: string } | null> {
    const { rows } = await this.db.query<{ id: string; subject: string | null; body: string }>(
      `SELECT id, subject, body FROM notification_templates
       WHERE tenant_id = $1 AND name = $2 AND is_active = true LIMIT 1`,
      [tenantId, name],
    );
    return rows[0] ?? null;
  }
}

/**
 * NotificationRepository port — abstract data access for notifications.
 * Repository pattern: no business logic, tenant-filtered, respects RLS.
 * Reference: Data Dictionary TB-NOTIFICATION · Phase 11
 */
import { Notification } from '../entities/notification.entity';

export interface NotificationPort {
  create(input: {
    tenant_id: string;
    userId: string;
    template_id?: string | null;
    channel: string;
    payload?: Record<string, unknown> | null;
  }): Promise<Notification>;
  findUserNotifications(tenantId: string, userId: string): Promise<Notification[]>;
  markAsRead(tenantId: string, userId: string, notificationId: string): Promise<Notification | null>;
  countUnread(tenantId: string, userId: string): Promise<number>;
  findTemplate(tenantId: string, name: string): Promise<{ id: string; subject: string | null; body: string } | null>;
}

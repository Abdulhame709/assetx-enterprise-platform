/**
 * Notification entity — notification record.
 * Reference: Data Dictionary (DOC-24) TB-NOTIFICATION · Phase 11
 * Reuses the existing notifications table — no schema change.
 */

export type NotificationChannel = 'push' | 'email' | 'whatsapp';

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string | null;
  channel: NotificationChannel;
  status: string; // queued | sent | read
  payload: Record<string, unknown> | null;
  created_at: Date;
  read_at: Date | null;
}

/** Input for creating a notification via NotificationService. */
export interface CreateNotificationInput {
  tenant_id: string;
  userId: string;
  channel?: NotificationChannel;
  templateName: string;
  payload?: Record<string, unknown>;
}

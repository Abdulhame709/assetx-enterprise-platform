/**
 * Notification template seed — inserts the notification templates used by the
 * NotificationService event→template mapping. Reuses notification_templates table.
 */
import { DatabasePort } from '../core/ports/database.port';

const TEMPLATES: Array<{ name: string; subject: string; body: string }> = [
  { name: 'inventory_assigned', subject: 'Inventory Campaign Assigned', body: 'You have been assigned to inventory campaign {{cycle}}.' },
  { name: 'inventory_completed', subject: 'Inventory Campaign Completed', body: 'Campaign {{cycle}} has been completed.' },
  { name: 'approval_required', subject: 'Approval Required', body: 'Action {{action}} requires your approval.' },
  { name: 'asset_transferred', subject: 'Asset Transferred', body: 'Asset {{asset_name}} has been transferred.' },
  { name: 'asset_created', subject: 'Asset Created', body: 'Asset {{asset_name}} has been created.' },
  { name: 'asset_status_changed', subject: 'Asset Status Changed', body: 'Asset {{asset_name}} status changed to {{status_name}}.' },
  { name: 'compliance_warning', subject: 'Compliance Warning', body: 'Compliance warning: {{check}} count {{count}}.' },
];

export async function seedNotificationTemplates(db: DatabasePort, tenantId: string): Promise<void> {
  for (const t of TEMPLATES) {
    await db.query(
      `INSERT INTO notification_templates (tenant_id, name, subject, body)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM notification_templates WHERE tenant_id = $1 AND name = $2
       )`,
      [tenantId, t.name, t.subject, t.body],
    );
  }
}

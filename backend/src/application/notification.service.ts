/**
 * NotificationService — converts domain events into notifications.
 * Subscribes to the EventBus and, for each event, looks up the matching template,
 * renders it, and persists a notification via the repository.
 * Does NOT replace AuditService — Audit = what happened, Notification = who needs to know.
 * Reference: Phase 11 Task 1
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { EventBus } from '../core/events/event-bus';
import { DomainEvent, DOMAIN_EVENTS } from '../core/events/event-types';
import { NotificationPort } from '../core/ports/notification.port';
import { TemplateRenderer } from './template-renderer.service';
import { Notification } from '../core/entities/notification.entity';
import { DATABASE_PORT, EVENT_BUS, NOTIFICATION_PORT } from '../core/ports/tokens';

@Injectable()
export class NotificationService implements OnModuleInit {
  // Map domain event type → template name + channel
  private readonly EVENT_TEMPLATES: Partial<Record<string, { template: string; channel: 'push' | 'email' }>> = {
    [DOMAIN_EVENTS.MOVEMENT_PENDING]: { template: 'approval_required', channel: 'push' },
    [DOMAIN_EVENTS.MOVEMENT_APPROVED]: { template: 'asset_transferred', channel: 'push' },
    [DOMAIN_EVENTS.MOVEMENT_REJECTED]: { template: 'approval_required', channel: 'push' },
    [DOMAIN_EVENTS.ASSET_CREATED]: { template: 'asset_created', channel: 'push' },
    [DOMAIN_EVENTS.ASSET_STATUS_CHANGED]: { template: 'asset_status_changed', channel: 'push' },
    [DOMAIN_EVENTS.INVENTORY_STARTED]: { template: 'inventory_assigned', channel: 'push' },
    [DOMAIN_EVENTS.INVENTORY_COMPLETED]: { template: 'inventory_completed', channel: 'push' },
    [DOMAIN_EVENTS.COMPLIANCE_WARNING]: { template: 'compliance_warning', channel: 'email' },
  };

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly renderer: TemplateRenderer,
  ) {}

  onModuleInit(): void {
    this.bus.subscribeAll((event) => void this.handleEvent(event));
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    const mapping = this.EVENT_TEMPLATES[event.event];
    if (!mapping) return; // no notification needed for this event
    // A user_id is required to deliver a notification.
    if (!event.userId) return;
    try {
      await this.create({
        tenant_id: event.tenant_id,
        userId: event.userId,
        templateName: mapping.template,
        channel: mapping.channel,
        payload: event.payload ?? {},
      });
    } catch {
      // Notification must never break the originating request.
    }
  }

  /** Create a notification from a template + payload. */
  async create(input: {
    tenant_id: string;
    userId: string;
    templateName: string;
    channel?: 'push' | 'email';
    payload?: Record<string, unknown>;
  }): Promise<Notification> {
    await this.db.setTenant(input.tenant_id);
    const template = await this.notifications.findTemplate(input.tenant_id, input.templateName);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    const rendered = this.renderer.render(template.body, input.payload ?? {});
    const subject = template.subject ? this.renderer.render(template.subject, input.payload ?? {}) : null;
    return this.notifications.create({
      tenant_id: input.tenant_id,
      userId: input.userId,
      template_id: template.id,
      channel: input.channel ?? 'push',
      payload: { ...(input.payload ?? {}), renderedBody: rendered, subject },
    });
  }

  async getUserNotifications(tenantId: string, userId: string): Promise<Notification[]> {
    await this.db.setTenant(tenantId);
    return this.notifications.findUserNotifications(tenantId, userId);
  }

  async markAsRead(tenantId: string, userId: string, id: string): Promise<Notification | null> {
    await this.db.setTenant(tenantId);
    return this.notifications.markAsRead(tenantId, userId, id);
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    await this.db.setTenant(tenantId);
    return this.notifications.countUnread(tenantId, userId);
  }
}

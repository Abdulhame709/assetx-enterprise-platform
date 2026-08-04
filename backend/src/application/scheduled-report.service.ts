/**
 * ScheduledReportService — generates a report on a schedule.
 * Depends on ReportScheduler port semantics + ExportService + EventBus.
 * It does NOT know about Notification/Audit/Email directly — it only publishes
 * a REPORT_GENERATED domain event; subscribers decide what to do.
 * Reference: Task T4 (approved design)
 */
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExportService } from './export.service';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';
import { ReportScheduler, ReportSchedule } from '../core/ports/report-scheduler.port';
import { EVENT_BUS } from '../core/ports/tokens';

export interface ReportExecutionContext {
  resource: string;
  format: string;
  limit?: number;
  tenantId: string;
  startedAt: Date;
}

@Injectable()
export class ScheduledReportService implements ReportScheduler {
  constructor(
    private readonly exports: ExportService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  /** Config-driven cron (env) — disabled unless SCHEDULED_REPORT_CRON is set. */
  @Cron(process.env.SCHEDULED_REPORT_CRON || '0 0 * * *', { name: 'scheduled-report', timeZone: process.env.SCHEDULED_REPORT_TZ || 'UTC' })
  async onSchedule(): Promise<void> {
    // Config-based report definition (env) — no DB, no user scheduling.
    const resource = process.env.SCHEDULED_REPORT_RESOURCE || 'dashboard';
    const format = process.env.SCHEDULED_REPORT_FORMAT || 'pdf';
    const tenantId = process.env.SCHEDULED_REPORT_TENANT || '';
    if (!tenantId) return; // no tenant configured → skip (no silent error)
    const limit = process.env.SCHEDULED_REPORT_LIMIT ? Number(process.env.SCHEDULED_REPORT_LIMIT) : undefined;
    await this.run({ resource, format, limit }, tenantId);
  }

  /** Execute one scheduled report generation. */
  async run(report: ReportSchedule, tenantId: string): Promise<void> {
    if (!tenantId) return;
    const startedAt = new Date();
    const result = await this.exports.generate({
      tenant_id: tenantId,
      userId: 'scheduler',
      resource: report.resource as never,
      format: report.format as never,
      options: { limit: report.limit ?? 10000, includeHeaders: true },
    });
    // Drain the stream so generation completes before publishing.
    await this.drain(result.stream);
    // Publish REPORT_GENERATED — subscribers (notification/email/webhook/audit)
    // decide what to do. Service has no direct coupling to them.
    this.bus.publish({
      event: DOMAIN_EVENTS.REPORT_GENERATED,
      tenant_id: tenantId,
      entityId: report.resource,
      payload: {
        resource: report.resource,
        format: report.format,
        filename: result.filename,
        rows: result.metadata.rows,
        duration: result.metadata.duration,
        startedAt: startedAt.toISOString(),
      },
    });
  }

  private drain(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      stream.on('data', () => { /* discard */ });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
  }
}

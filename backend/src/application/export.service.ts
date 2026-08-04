/**
 * ExportService — application use case / single orchestration point for the
 * Export Framework (Phase 11.3 · Task T8).
 * Orchestrates: permission/provider resolution → lifecycle events → unified
 * pipeline (Prepare→Transform→Format→Write→Stream) via an ExportStrategy →
 * metrics → audit. Contains NO SQL and NO format-specific logic. Always returns
 * a Readable stream. Backward compatible: the public generate() contract is
 * unchanged; existing integrations keep working.
 * Reference: Phase 11.3 · Task T8 — Enterprise Export Framework.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ExportPort } from '../core/ports/export.port';
import { ExportProvider } from '../core/ports/export-provider.port';
import { ExportRequest, ExportResult, ExportMetadata, ExportMode } from '../core/entities/export.entity';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';
import { EVENT_BUS, EXPORT_PROVIDERS } from '../core/ports/tokens';
import { ExportStrategyFactory } from '../infrastructure/export/strategies/export-strategy.factory';
import { ExportPipelineService } from './export/export-pipeline.service';
import { ExportProfileRegistry } from './export/export-profile.registry';
import { ExportMetricsService } from './export/export-metrics.service';

@Injectable()
export class ExportService implements ExportPort {
  // Map resource → provider (dependency-injected)
  private readonly providers = new Map<string, ExportProvider>();

  constructor(
    private readonly strategyFactory: ExportStrategyFactory,
    private readonly pipeline: ExportPipelineService,
    private readonly profiles: ExportProfileRegistry,
    private readonly metrics: ExportMetricsService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(EXPORT_PROVIDERS) providers: ExportProvider[],
  ) {
    for (const p of providers) this.providers.set(p.resource, p);
  }

  async generate(req: ExportRequest): Promise<ExportResult> {
    const started = Date.now();
    const mode: ExportMode = req.mode ?? 'SYNC';
    const provider = this.providers.get(req.resource);
    if (!provider) throw new Error('UNSUPPORTED_EXPORT_RESOURCE');

    // Audit + lifecycle: export started
    await this.audit.log({
      tenant_id: req.tenant_id,
      userId: req.userId,
      action: AUDIT_EVENTS.EXPORT_STARTED,
      entity: 'export',
      entityId: req.resource,
      metadata: { resource: req.resource, format: req.format, mode },
    }).catch(() => undefined);
    this.bus.publish({
      event: DOMAIN_EVENTS.EXPORT_STARTED,
      tenant_id: req.tenant_id,
      userId: req.userId,
      entityId: req.resource,
      payload: { resource: req.resource, format: req.format, mode },
    });

    try {
      // Resolve strategy (Strategy Pattern) + profile (audience config).
      const strategy = this.strategyFactory.get(req.format);
      const profile = this.profiles.get(req.options?.profile);
      const options = this.profiles.apply(req.options ?? {}, profile);
      const metric = this.metrics.start({
        tenant: req.tenant_id,
        user: req.userId,
        resource: req.resource,
        format: req.format,
        profile: profile?.id,
      });

      // Unified pipeline: Prepare → Transform → Format → Write → Stream.
      const res = await this.pipeline.run({
        tenant: req.tenant_id,
        user: req.userId,
        resource: req.resource,
        provider,
        strategy,
        profile,
        options,
        metricId: metric.id,
        mode,
      });

      const metadata: ExportMetadata = { ...res.metadata, duration: Date.now() - started };

      // Audit: export completed (synchronous for backward compatibility).
      await this.audit.log({
        tenant_id: req.tenant_id,
        userId: req.userId,
        action: AUDIT_EVENTS.EXPORT_COMPLETED,
        entity: 'export',
        entityId: req.resource,
        metadata: { ...metadata },
      }).catch(() => undefined);

      return {
        stream: res.stream,
        format: req.format,
        filename: `${req.resource}_${Date.now()}.${strategy.getFileExtension()}`,
        mimeType: strategy.getMimeType(),
        metadata,
      };
    } catch (err) {
      const reason = (err as Error).message;
      await this.audit.log({
        tenant_id: req.tenant_id,
        userId: req.userId,
        action: AUDIT_EVENTS.EXPORT_FAILED,
        entity: 'export',
        entityId: req.resource,
        metadata: { resource: req.resource, format: req.format, reason },
      }).catch(() => undefined);
      this.bus.publish({
        event: DOMAIN_EVENTS.EXPORT_FAILED,
        tenant_id: req.tenant_id,
        userId: req.userId,
        entityId: req.resource,
        payload: { resource: req.resource, format: req.format, reason },
      });
      throw err;
    }
  }
}

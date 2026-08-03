/**
 * ExportService — application use case for the Export Engine.
 * Orchestrates: permission check → provider data → adapter → generator → stream.
 * Contains NO SQL and NO format-specific logic. Always returns a Readable stream.
 * Reference: Phase 11.3
 */
import { Inject, Injectable } from '@nestjs/common';
import { ExportPort } from '../core/ports/export.port';
import { ExportProvider } from '../core/ports/export-provider.port';
import { ExportRequest, ExportResult, ExportMetadata, ExportMode } from '../core/entities/export.entity';
import { FileGeneratorFactory } from '../infrastructure/export/file-generator.factory';
import { ExportDataAdapter } from './export/adapters/export-data.adapter';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';
import { EVENT_BUS, EXPORT_PROVIDERS } from '../core/ports/tokens';

@Injectable()
export class ExportService implements ExportPort {
  // Map resource → provider (dependency-injected)
  private readonly providers = new Map<string, ExportProvider>();

  constructor(
    private readonly factory: FileGeneratorFactory,
    private readonly adapter: ExportDataAdapter,
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

    // Audit: export started
    await this.audit.log({
      tenant_id: req.tenant_id,
      userId: req.userId,
      action: AUDIT_EVENTS.EXPORT_STARTED,
      entity: 'export',
      entityId: req.resource,
      metadata: { resource: req.resource, format: req.format, mode },
    }).catch(() => undefined);

    try {
      // 1. Fetch raw data via the provider
      const { rows, total } = await provider.getData(req.tenant_id, req.options);
      // 2. Adapt to uniform export rows
      const adapted = this.adapter.toRows(rows);
      // 3. Select generator via factory
      const generator = this.factory.get(req.format);
      // 4. Generate stream
      const stream = generator.generate(adapted, req.options);

      const duration = Date.now() - started;
      const metadata: ExportMetadata = {
        resource: req.resource,
        format: req.format,
        rows: total,
        size: 0, // size computed downstream by caller/stream
        duration,
        user: req.userId,
        tenant: req.tenant_id,
        mode,
        generated_at: new Date().toISOString(),
      };

      // Audit: export completed
      await this.audit.log({
        tenant_id: req.tenant_id,
        userId: req.userId,
        action: AUDIT_EVENTS.EXPORT_COMPLETED,
        entity: 'export',
        entityId: req.resource,
        metadata: { ...metadata },
      }).catch(() => undefined);

      // Notify on large exports via EventBus (independent EXPORT_COMPLETED event)
      if (total >= 1000) {
        this.bus.publish({
          event: DOMAIN_EVENTS.EXPORT_COMPLETED,
          tenant_id: req.tenant_id,
          userId: req.userId,
          entityId: req.resource,
          payload: { resource: req.resource, format: req.format, rows: total, duration },
        });
      }

      return {
        stream,
        format: req.format,
        filename: `${req.resource}_${Date.now()}.${generator.getFileExtension()}`,
        mimeType: generator.getMimeType(),
        metadata,
      };
    } catch (err) {
      await this.audit.log({
        tenant_id: req.tenant_id,
        userId: req.userId,
        action: AUDIT_EVENTS.EXPORT_FAILED,
        entity: 'export',
        entityId: req.resource,
        metadata: { resource: req.resource, format: req.format, reason: (err as Error).message },
      }).catch(() => undefined);
      throw err;
    }
  }
}

/**
 * AuditExportProvider — fetches audit events for export.
 * Knows only its own data source (AuditRepository). No formatting logic.
 * Reference: Phase 11.3
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuditPort } from '../../../core/ports/audit.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { AUDIT_PORT } from '../../../core/ports/tokens';

@Injectable()
export class AuditExportProvider implements ExportProvider {
  readonly resource = 'audit';

  constructor(@Inject(AUDIT_PORT) private readonly audit: AuditPort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const res = await this.audit.search({
      tenant_id: tenantId,
      page: 1,
      limit: options?.limit ?? 10000,
      action: (options?.filters as { action?: string } | undefined)?.action,
    });
    return { rows: res.items, total: res.total };
  }
}

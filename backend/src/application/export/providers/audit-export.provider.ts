/**
 * AuditExportProvider — fetches audit events for export.
 * Knows only its own data source (AuditRepository). No formatting logic beyond
 * exposing the entity/metadata columns and resolving the user name.
 * Reference: Phase 11.3
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuditPort } from '../../../core/ports/audit.port';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { AUDIT_PORT, DATABASE_PORT } from '../../../core/ports/tokens';
import { isoDate, loadNameMaps, nameOf } from '../export-lookups';

@Injectable()
export class AuditExportProvider implements ExportProvider {
  readonly resource = 'audit';

  constructor(
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const res = await this.audit.search({
      tenant_id: tenantId,
      page: 1,
      limit: options?.limit ?? 10000,
      action: (options?.filters as { action?: string } | undefined)?.action,
    });
    const names = await loadNameMaps(this.db, tenantId);
    const rows = res.items.map((e) => ({
      id: e.id,
      action_type: e.action_type,
      // stored columns are table_name/record_id/details; the report calls them entity/entity_id/metadata
      entity: e.table_name,
      entity_id: e.record_id,
      user_id: e.user_id,
      user_name: nameOf(names.users, e.user_id),
      created_at: isoDate(e.created_at, true),
      metadata: e.details ? JSON.stringify(e.details) : '',
      ip_address: e.ip_address ?? '',
    }));
    return { rows, total: res.total };
  }
}

/**
 * AuditSearchProvider — searches audit events via AuditPort.search.
 * Reference: Advanced-Search-Design-Specification §2
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuditPort } from '../../../core/ports/audit.port';
import { SearchCriteria } from '../search-query-builder';
import { SearchProvider, SearchResult } from '../../../core/ports/search-provider.port';
import { AUDIT_PORT } from '../../../core/ports/tokens';

@Injectable()
export class AuditSearchProvider implements SearchProvider {
  readonly resource = 'audit';

  constructor(@Inject(AUDIT_PORT) private readonly audit: AuditPort) {}

  async search(tenantId: string, criteria: SearchCriteria): Promise<SearchResult> {
    const f = criteria.filters;
    const res = await this.audit.search({
      tenant_id: tenantId,
      action: f.action as string,
      entity: f.entity as string,
      userId: f.user_id as string,
      recordId: f.record_id as string,
      dateFrom: f.created_at_from as string,
      dateTo: f.created_at_to as string,
      page: criteria.page,
      limit: criteria.limit,
    });
    return {
      items: res.items,
      total: res.total,
      page: criteria.page,
      limit: criteria.limit,
      hasMore: criteria.page * criteria.limit < res.total,
    };
  }
}

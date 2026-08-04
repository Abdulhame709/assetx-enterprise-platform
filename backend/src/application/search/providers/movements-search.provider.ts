/**
 * MovementsSearchProvider — searches movements via MovementPort.searchAdvanced.
 * Reference: Advanced-Search-Design-Specification §2
 */
import { Inject, Injectable } from '@nestjs/common';
import { MovementPort } from '../../../core/ports/movement.port';
import { SearchCriteria } from '../search-query-builder';
import { SearchProvider, SearchResult } from '../../../core/ports/search-provider.port';
import { MOVEMENT_PORT } from '../../../core/ports/tokens';

@Injectable()
export class MovementsSearchProvider implements SearchProvider {
  readonly resource = 'movements';

  constructor(@Inject(MOVEMENT_PORT) private readonly movements: MovementPort) {}

  async search(tenantId: string, criteria: SearchCriteria): Promise<SearchResult> {
    const f = criteria.filters;
    const res = await this.movements.searchAdvanced(tenantId, {
      status: f.status as never,
      movement_type: f.movement_type as never,
      performed_by: f.performed_by as string,
      asset_id: f.asset_id as string,
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

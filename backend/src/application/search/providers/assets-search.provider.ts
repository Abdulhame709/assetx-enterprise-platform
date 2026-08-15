/**
 * AssetsSearchProvider — searches assets using AssetPort.searchAdvanced.
 * Translates SearchCriteria into an AssetFilter (tenant injected by service).
 * Reference: Advanced-Search-Design-Specification §2
 */
import { Inject, Injectable } from '@nestjs/common';
import { AssetPort } from '../../../core/ports/asset.port';
import { SearchCriteria } from '../search-query-builder';
import { SearchProvider, SearchResult } from '../../../core/ports/search-provider.port';
import { ASSET_PORT } from '../../../core/ports/tokens';
import { smartSearch } from '../../asset-algorithms';

@Injectable()
export class AssetsSearchProvider implements SearchProvider {
  readonly resource = 'assets';

  constructor(@Inject(ASSET_PORT) private readonly assets: AssetPort) {}

  async search(tenantId: string, criteria: SearchCriteria): Promise<SearchResult> {
    const res = await this.assets.searchAdvanced({
      tenant_id: tenantId,
      ...this.toFilter(criteria),
    });
    return {
      items: this.rankWithSmartSearch(res.items, criteria.q),
      total: res.total,
      page: criteria.page,
      limit: criteria.limit,
      hasMore: criteria.page * criteria.limit < res.total,
    };
  }

  /**
   * SQL remains responsible for tenant-safe filtering; README §13 supplies
   * deterministic relevance ordering across name and generated asset codes.
   */
  private rankWithSmartSearch<T extends { id: string; name: string; base_asset_code: string; full_asset_code: string }>(
    items: T[],
    query: string | undefined,
  ): T[] {
    if (!query?.trim()) return items;
    const candidates = items.map((item) => ({
      item,
      name: item.name,
      baseAssetCode: item.base_asset_code,
      fullAssetCode: item.full_asset_code,
    }));
    const scores = new Map(
      smartSearch(candidates, query).map(({ item, score }) => [item.item.id, score]),
    );
    return [...items].sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0));
  }

  private toFilter(c: SearchCriteria): Omit<Parameters<AssetPort['searchAdvanced']>[0], 'tenant_id'> {
    const f = c.filters;
    return {
      q: c.q,
      status_id: f.status_id as string,
      category_id: f.category_id as string,
      location_id: f.location_id as string,
      employee_id: f.employee_id as string,
      barcode: f.barcode as string,
      serial_number: f.serial_number as string,
      reference_number: f.reference_number as string,
      purchase_date_from: f.purchase_date_from as string,
      purchase_date_to: f.purchase_date_to as string,
      price_from: f.price_from as number,
      price_to: f.price_to as number,
      is_active: f.is_active as boolean,
      sortField: c.sort?.field,
      sortDir: c.sort?.dir,
      page: c.page,
      limit: c.limit,
    };
  }
}

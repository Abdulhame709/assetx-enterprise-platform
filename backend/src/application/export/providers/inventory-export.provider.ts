/**
 * InventoryExportProvider — fetches inventory result data for export.
 * Uses the latest cycle's results from InventoryResultService. No formatting logic.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { InventoryResultService } from '../../inventory-result.service';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';

@Injectable()
export class InventoryExportProvider implements ExportProvider {
  readonly resource = 'inventory';

  constructor(private readonly results: InventoryResultService) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    // Use the most recent cycle for inventory results (options may specify cycle_id)
    const cycleId = (options?.filters as { cycle_id?: string } | undefined)?.cycle_id;
    if (!cycleId) {
      // find latest cycle id via results repo is not exposed here; for now export from
      // inventory analytics (aggregate) if no cycle given.
      const summary = await this.results.getSummaryForLatest(tenantId);
      return { rows: summary ? [summary] : [], total: summary ? 1 : 0 };
    }
    const rows = await this.results.getResults(cycleId, tenantId);
    return { rows, total: rows.length };
  }
}

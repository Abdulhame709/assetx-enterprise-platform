/**
 * DashboardExportProvider — fetches dashboard analytics for export.
 * Knows only its own data source (ReportingService). No formatting logic.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { ReportingService } from '../../reporting.service';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';

@Injectable()
export class DashboardExportProvider implements ExportProvider {
  readonly resource = 'dashboard';

  constructor(private readonly reporting: ReportingService) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const [assets, movements, inventory, aging] = await Promise.all([
      this.reporting.getAssetDashboard(tenantId),
      this.reporting.getMovementAnalytics(tenantId),
      this.reporting.getInventoryAnalytics(tenantId),
      this.reporting.getAssetAging(tenantId),
    ]);
    const rows = [
      { section: 'assets', ...assets },
      { section: 'movements', ...movements },
      { section: 'inventory', ...inventory },
      { section: 'aging', total_assets: aging.total_assets, avg_age: aging.avg_age, high_value: aging.high_value, near_replacement: aging.near_replacement },
    ];
    return { rows, total: rows.length };
  }
}

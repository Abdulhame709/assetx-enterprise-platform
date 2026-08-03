/**
 * AssetsExportProvider — fetches asset data for export.
 * Knows only its own data source (AssetRepository). No formatting logic.
 * Reference: Phase 11.3 (architecture note 1)
 */
import { Inject, Injectable } from '@nestjs/common';
import { AssetPort } from '../../../core/ports/asset.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { ASSET_PORT } from '../../../core/ports/tokens';

@Injectable()
export class AssetsExportProvider implements ExportProvider {
  readonly resource = 'assets';

  constructor(@Inject(ASSET_PORT) private readonly assets: AssetPort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const res = await this.assets.search({
      tenant_id: tenantId,
      page: 1,
      limit: options?.limit ?? 10000,
      ...(options?.filters as Record<string, unknown> | undefined),
    });
    return { rows: res.items, total: res.total };
  }
}

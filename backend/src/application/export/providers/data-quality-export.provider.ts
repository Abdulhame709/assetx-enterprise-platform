/**
 * DataQualityExportProvider — one report profile per data-quality check
 * (duplicate serials, missing fields, naming, anomalies, stale assets,
 * suspicious movements). The rows come from DataQualityService; the normal
 * export pipeline adds preview / PDF / Excel / CSV on top.
 * Optional filter: days (stale threshold, or movement look-back).
 */
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { DataQualityResource, DataQualityService } from '../data-quality.service';

export class DataQualityExportProvider implements ExportProvider {
  constructor(readonly resource: DataQualityResource, private readonly service: DataQualityService) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const days = Number(filters.days);
    const rows = await this.service.rows(tenantId, this.resource, {
      lang: options?.meta?.lang === 'en' ? 'en' : 'ar',
      ...(Number.isInteger(days) && days > 0 ? { days } : {}),
    });
    return { rows, total: rows.length };
  }
}

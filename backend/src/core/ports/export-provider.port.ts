/**
 * ExportProvider port — each provider knows only its own data source.
 * A provider fetches raw data for a resource within a tenant; it holds NO
 * formatting/stream logic. This decouples ExportService from repositories.
 * Reference: Phase 11.3 (architecture note 1)
 */
import { ExportOptions } from '../entities/export.entity';

export interface ExportProvider {
  /** resource handled by this provider (assets, movements, inventory, audit, dashboard) */
  readonly resource: string;
  /** fetch raw data for export; row data only (no format-specific structure) */
  getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }>;
}

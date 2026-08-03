/**
 * ReportingService — read-only analytics use cases.
 * Reference: FRS FR-DSH-* / FR-RPT-* · AAB §13.9
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { ReportingPort } from '../core/ports/reporting.port';
import {
  AssetDashboard,
  MovementAnalytics,
  InventoryAnalytics,
  AssetAging,
} from '../core/entities/dashboard.entity';
import { DATABASE_PORT, REPORTING_PORT } from '../core/ports/tokens';

@Injectable()
export class ReportingService {
  constructor(
    @Inject(REPORTING_PORT) private readonly reporting: ReportingPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async getAssetDashboard(tenantId: string): Promise<AssetDashboard> {
    await this.db.setTenant(tenantId);
    return this.reporting.getAssetDashboard(tenantId);
  }

  async getMovementAnalytics(tenantId: string): Promise<MovementAnalytics> {
    await this.db.setTenant(tenantId);
    return this.reporting.getMovementAnalytics(tenantId);
  }

  async getInventoryAnalytics(tenantId: string): Promise<InventoryAnalytics> {
    await this.db.setTenant(tenantId);
    return this.reporting.getInventoryAnalytics(tenantId);
  }

  async getAssetAging(tenantId: string): Promise<AssetAging> {
    await this.db.setTenant(tenantId);
    return this.reporting.getAssetAging(tenantId);
  }
}

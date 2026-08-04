/**
 * AssetAnalyticsController — read-only asset analytics summary (Phase P2).
 * GET /assets/analytics/summary — dashboard presentation data. Uses the new
 * AssetAnalyticsService read model; does NOT modify ReportingService/AssetService.
 * Gated by asset.view.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AssetAnalyticsService } from '../../application/asset-analytics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('assets')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class AssetAnalyticsController {
  constructor(private readonly analytics: AssetAnalyticsService) {}

  @Get('analytics/summary')
  @RequirePermission('asset.view')
  summary(@CurrentUser() user: RequestUser) {
    return this.analytics.summary(user.tenant_id);
  }
}

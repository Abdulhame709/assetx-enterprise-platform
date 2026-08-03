/**
 * DashboardController — Reporting & Analytics APIs (read-only).
 * Reference: API Spec (DOC-10) §11 Dashboard · FRS FR-DSH-*
 * RBAC: read access for management/auditor roles.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportingService } from '../../application/reporting.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('assets')
  @RequirePermission('dashboard.view')
  assetDashboard(@CurrentUser() user: RequestUser) {
    return this.reporting.getAssetDashboard(user.tenant_id);
  }

  @Get('movements')
  @RequirePermission('dashboard.view')
  movementAnalytics(@CurrentUser() user: RequestUser) {
    return this.reporting.getMovementAnalytics(user.tenant_id);
  }

  @Get('inventory')
  @RequirePermission('dashboard.view')
  inventoryAnalytics(@CurrentUser() user: RequestUser) {
    return this.reporting.getInventoryAnalytics(user.tenant_id);
  }

  @Get('aging')
  @RequirePermission('dashboard.view')
  assetAging(@CurrentUser() user: RequestUser) {
    return this.reporting.getAssetAging(user.tenant_id);
  }
}

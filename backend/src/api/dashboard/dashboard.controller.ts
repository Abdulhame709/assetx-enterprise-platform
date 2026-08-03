/**
 * DashboardController — Reporting & Analytics APIs (read-only).
 * Reference: API Spec (DOC-10) §11 Dashboard · FRS FR-DSH-*
 * RBAC: read access for management/auditor roles.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportingService } from '../../application/reporting.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
export class DashboardController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('assets')
  assetDashboard(@CurrentUser() user: RequestUser) {
    return this.reporting.getAssetDashboard(user.tenant_id);
  }

  @Get('movements')
  movementAnalytics(@CurrentUser() user: RequestUser) {
    return this.reporting.getMovementAnalytics(user.tenant_id);
  }

  @Get('inventory')
  inventoryAnalytics(@CurrentUser() user: RequestUser) {
    return this.reporting.getInventoryAnalytics(user.tenant_id);
  }

  @Get('aging')
  assetAging(@CurrentUser() user: RequestUser) {
    return this.reporting.getAssetAging(user.tenant_id);
  }
}

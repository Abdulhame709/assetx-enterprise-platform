/**
 * AuditController — Audit & Compliance APIs.
 * Reference: FRS FR-AUD-* · ADR-010
 * Permission: audit.view
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from '../../application/audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('audit')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @RequirePermission('audit.view')
  events(
    @CurrentUser() current: RequestUser,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('user') user?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.query({
      tenant_id: current.tenant_id,
      action,
      entity,
      userId: user,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('security')
  @RequirePermission('audit.view')
  security(@CurrentUser() current: RequestUser) {
    // security-relevant events: login failures, permission denied/changed
    return this.audit.securityQuery(current.tenant_id, 1, 100);
  }

  @Get('assets/:id')
  @RequirePermission('audit.view')
  assetTimeline(@Param('id') id: string, @CurrentUser() current: RequestUser) {
    return this.audit.assetTimeline(current.tenant_id, id);
  }
}

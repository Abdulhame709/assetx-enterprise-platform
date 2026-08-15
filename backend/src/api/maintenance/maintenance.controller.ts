import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MaintenanceService } from '../../application/maintenance.service';
import { MaintenanceWorkflowStatus } from '../../core/entities/maintenance.entity';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { CompleteMaintenanceOrderDto, CreateMaintenanceOrderDto } from '../dto/maintenance.dto';

@Controller()
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post('assets/:id/maintenance')
  @RequirePermission('maintenance.create')
  create(@Param('id') assetId: string, @Body() dto: CreateMaintenanceOrderDto, @CurrentUser() user: RequestUser) {
    assertUuid(assetId);
    return this.maintenance.create(user.tenant_id, assetId, { ...dto, created_by: user.sub });
  }

  @Get('assets/:id/maintenance')
  @RequirePermission('maintenance.view')
  listByAsset(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    assertUuid(assetId);
    return this.maintenance.listByAsset(user.tenant_id, assetId);
  }

  @Get('maintenance')
  @RequirePermission('maintenance.view')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: MaintenanceWorkflowStatus) {
    return this.maintenance.list(user.tenant_id, status);
  }

  @Patch('maintenance/:id/start')
  @RequirePermission('maintenance.manage')
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.maintenance.start(user.tenant_id, id, user.sub);
  }

  @Patch('maintenance/:id/complete')
  @RequirePermission('maintenance.manage')
  complete(@Param('id') id: string, @Body() dto: CompleteMaintenanceOrderDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.maintenance.complete(user.tenant_id, id, user.sub, dto);
  }
}

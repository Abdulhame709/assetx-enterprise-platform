/**
 * StatusController — Asset status master-data APIs (auth + tenant + RBAC).
 * Reference: API Spec (DOC-10) · AAB §13.13 (AssetStatus module registry)
 */
import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { StatusService } from '../../application/status.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { CreateStatusDto, UpdateStatusDto } from '../dto/master-data.dto';

@Controller('statuses')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class StatusController {
  constructor(private readonly statuses: StatusService) {}

  @Post()
  @RequirePermission('status.create')
  create(@Body() dto: CreateStatusDto, @CurrentUser() user: RequestUser) {
    return this.statuses.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @RequirePermission('status.view')
  list(@CurrentUser() user: RequestUser) {
    return this.statuses.list(user.tenant_id);
  }

  @Get(':id')
  @RequirePermission('status.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.statuses.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @RequirePermission('status.update')
  update(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.statuses.update(id, user.tenant_id, dto);
  }
}

/**
 * LocationController — Location APIs (auth + tenant + RBAC).
 * Reference: API Spec (DOC-10) §5
 */
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { LocationService } from '../../application/location.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid, assertOptionalUuid } from '../../common/utils/uuid';
import { CreateLocationDto, UpdateLocationDto } from '../dto/master-data.dto';

@Controller('locations')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class LocationController {
  constructor(private readonly locations: LocationService) {}

  @Post()
  @RequirePermission('location.create')
  create(@Body() dto: CreateLocationDto, @CurrentUser() user: RequestUser) {
    assertOptionalUuid(dto.parent_id);
    return this.locations.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @RequirePermission('location.view')
  list(@CurrentUser() user: RequestUser) {
    return this.locations.list(user.tenant_id);
  }

  @Get(':id')
  @RequirePermission('location.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.locations.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @RequirePermission('location.update')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.locations.update(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @RequirePermission('location.delete')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.locations.softDelete(id, user.tenant_id).then(() => ({ message: 'deleted' }));
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LocationTypeService } from '../../application/location-type.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { CreateLocationTypeDto, UpdateLocationTypeDto } from '../dto/master-data.dto';

@Controller('location-types')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class LocationTypeController {
  constructor(private readonly types: LocationTypeService) {}

  @Post()
  @RequirePermission('location_type.create')
  create(@Body() dto: CreateLocationTypeDto, @CurrentUser() user: RequestUser) {
    return this.types.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @RequirePermission('location_type.view')
  list(@CurrentUser() user: RequestUser) {
    return this.types.list(user.tenant_id, true);
  }

  @Get(':id')
  @RequirePermission('location_type.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.types.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @RequirePermission('location_type.update')
  update(@Param('id') id: string, @Body() dto: UpdateLocationTypeDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.types.update(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @RequirePermission('location_type.delete')
  async deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    await this.types.deactivate(id, user.tenant_id, user.sub);
    return { id, deactivated: true };
  }
}

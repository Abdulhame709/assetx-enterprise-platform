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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateLocationDto, UpdateLocationDto } from '../dto/master-data.dto';

@Controller('locations')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class LocationController {
  constructor(private readonly locations: LocationService) {}

  @Post()
  @Roles('Administrator', 'Asset Manager')
  create(@Body() dto: CreateLocationDto, @CurrentUser() user: RequestUser) {
    return this.locations.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  list(@CurrentUser() user: RequestUser) {
    return this.locations.list(user.tenant_id);
  }

  @Get(':id')
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.locations.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @Roles('Administrator', 'Asset Manager')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto, @CurrentUser() user: RequestUser) {
    return this.locations.update(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @Roles('Administrator', 'Asset Manager')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.locations.softDelete(id, user.tenant_id).then(() => ({ message: 'deleted' }));
  }
}

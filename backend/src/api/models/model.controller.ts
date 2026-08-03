/**
 * ModelController — Model APIs (auth + tenant + RBAC).
 * Reference: API Spec (DOC-10)
 */
import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ModelService } from '../../application/model.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateModelDto, UpdateModelDto } from '../dto/master-data.dto';

@Controller('models')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ModelController {
  constructor(private readonly models: ModelService) {}

  @Post()
  @Roles('Administrator', 'Asset Manager')
  create(@Body() dto: CreateModelDto, @CurrentUser() user: RequestUser) {
    return this.models.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  list(@CurrentUser() user: RequestUser) {
    return this.models.list(user.tenant_id);
  }

  @Get(':id')
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.models.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @Roles('Administrator', 'Asset Manager')
  update(@Param('id') id: string, @Body() dto: UpdateModelDto, @CurrentUser() user: RequestUser) {
    return this.models.update(id, user.tenant_id, dto);
  }
}

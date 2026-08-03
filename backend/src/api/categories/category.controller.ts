/**
 * CategoryController — Category APIs (auth + tenant + RBAC).
 * Reference: API Spec (DOC-10)
 */
import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CategoryService } from '../../application/category.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/master-data.dto';

@Controller('categories')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Post()
  @Roles('Administrator', 'Asset Manager')
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: RequestUser) {
    return this.categories.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  list(@CurrentUser() user: RequestUser) {
    return this.categories.list(user.tenant_id);
  }

  @Get(':id')
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.categories.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @Roles('Administrator', 'Asset Manager')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: RequestUser) {
    return this.categories.update(id, user.tenant_id, dto);
  }
}

/**
 * EmployeeController — Employee APIs (auth + tenant + RBAC).
 * Reference: API Spec (DOC-10) §6
 */
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { EmployeeService } from '../../application/employee.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/master-data.dto';

@Controller('employees')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Post()
  @RequirePermission('employee.create')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @RequirePermission('employee.view')
  list(@CurrentUser() user: RequestUser) {
    return this.employees.list(user.tenant_id);
  }

  @Get(':id')
  @RequirePermission('employee.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.employees.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @RequirePermission('employee.update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.employees.update(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @RequirePermission('employee.delete')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.employees.softDelete(id, user.tenant_id).then(() => ({ message: 'deleted' }));
  }
}

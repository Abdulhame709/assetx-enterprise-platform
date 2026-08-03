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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/master-data.dto';

@Controller('employees')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Post()
  @Roles('Administrator', 'Asset Manager')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.create({ tenant_id: user.tenant_id, ...dto });
  }

  @Get()
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  list(@CurrentUser() user: RequestUser) {
    return this.employees.list(user.tenant_id);
  }

  @Get(':id')
  @Roles('Administrator', 'Asset Manager', 'Auditor', 'Department Manager')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.employees.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @Roles('Administrator', 'Asset Manager')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.update(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @Roles('Administrator', 'Asset Manager')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.employees.softDelete(id, user.tenant_id).then(() => ({ message: 'deleted' }));
  }
}

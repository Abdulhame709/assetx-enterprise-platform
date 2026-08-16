/**
 * UsersController — current-user APIs (authenticated, tenant-scoped).
 * GET /users/me · PATCH /users/profile
 * Reference: API Spec (DOC-10) §13 (admin/users) + user profile
 */
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../application/users.service';

@Controller('users')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const profile = await this.users.me(user.sub);
    if (!profile) throw new Error('USER_NOT_FOUND');
    return profile;
  }

  @Get('admin/users')
  @RequirePermission('admin.user')
  listTenantUsers(@CurrentUser() user: RequestUser) {
    return this.users.listTenantUsers(user.tenant_id);
  }

  @Get('admin/roles')
  @RequirePermission('admin.role')
  listTenantRoles(@CurrentUser() user: RequestUser) {
    return this.users.listTenantRoles(user.tenant_id);
  }

  @Patch('admin/users/:id/status')
  @RequirePermission('admin.user')
  async updateTenantUserStatus(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { is_active?: boolean },
  ) {
    assertUuid(id);
    if (typeof dto.is_active !== 'boolean') throw new Error('INVALID_USER_STATUS');
    if (id === user.sub && !dto.is_active) throw new Error('SELF_DEACTIVATION_NOT_ALLOWED');
    const updated = await this.users.updateTenantUserStatus(id, user.tenant_id, dto.is_active);
    if (!updated) throw new Error('USER_NOT_FOUND');
    return updated;
  }

  @Patch('admin/users/:id/roles')
  @RequirePermission('admin.role')
  async replaceTenantUserRoles(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { role_ids?: string[] },
  ) {
    assertUuid(id);
    if (id === user.sub) throw new Error('SELF_ROLE_CHANGE_NOT_ALLOWED');
    if (!Array.isArray(dto.role_ids) || dto.role_ids.some((roleId) => typeof roleId !== 'string')) {
      throw new Error('INVALID_ROLE_IDS');
    }
    dto.role_ids.forEach(assertUuid);
    const users = await this.users.replaceTenantUserRoles(id, user.tenant_id, [...new Set(dto.role_ids)]);
    if (!users) throw new Error('USER_NOT_FOUND');
    return users;
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: RequestUser, @Body() dto: { email?: string }) {
    const updated = await this.users.updateProfile(user.sub, { email: dto.email });
    if (!updated) throw new Error('USER_NOT_FOUND');
    return updated;
  }
}

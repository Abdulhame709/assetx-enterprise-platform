/**
 * UsersController — current-user APIs (authenticated, tenant-scoped).
 * GET /users/me · PATCH /users/profile
 * Reference: API Spec (DOC-10) §13 (admin/users) + user profile
 */
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../application/users.service';

@Controller('users')
@UseGuards(AuthGuard, TenantGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const profile = await this.users.me(user.sub);
    if (!profile) throw new Error('USER_NOT_FOUND');
    return profile;
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: RequestUser, @Body() dto: { email?: string }) {
    const updated = await this.users.updateProfile(user.sub, { email: dto.email });
    if (!updated) throw new Error('USER_NOT_FOUND');
    return updated;
  }
}

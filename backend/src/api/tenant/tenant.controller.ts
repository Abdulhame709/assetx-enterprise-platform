/**
 * TenantController — current-tenant API (authenticated, tenant-scoped).
 * GET /tenant/current
 * Reference: API Spec (DOC-10) · Security (tenant isolation, ADR-004)
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { UserRepository } from '../../infrastructure/repositories/user.repository';

@Controller('tenant')
@UseGuards(AuthGuard, TenantGuard)
export class TenantController {
  constructor(private readonly users: UserRepository) {}

  @Get('current')
  async current(@CurrentUser() user: RequestUser) {
    const tenant = await this.users.findTenant(user.tenant_id);
    if (!tenant) throw new Error('TENANT_NOT_FOUND');
    return tenant;
  }
}

/**
 * LifecycleController — read-only lifecycle API (Phase P2).
 * Serves the Asset 360 Lifecycle tab. Uses the existing L1 state machine via
 * LifecycleReadService. Read-only, tenant-scoped, gated by asset.view
 * (deliberately reuses asset.view — no new lifecycle.read permission).
 */
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LifecycleReadService } from '../../application/lifecycle-read.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';

@Controller('lifecycle')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleReadService) {}

  @Get('assets/:id/state')
  @RequirePermission('asset.view')
  state(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.lifecycle.getState(id, user.tenant_id);
  }

  @Get('assets/:id/transitions')
  @RequirePermission('asset.view')
  transitions(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.lifecycle.getTransitions(id, user.tenant_id);
  }
}

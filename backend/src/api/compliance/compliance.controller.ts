/**
 * ComplianceController — data integrity / compliance health APIs.
 * Reference: ADR-010 · Data Governance
 * Permission: compliance.view
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ComplianceService } from '../../application/compliance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('compliance')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('health')
  @RequirePermission('compliance.view')
  health(@CurrentUser() current: RequestUser) {
    return this.compliance.health(current.tenant_id);
  }
}

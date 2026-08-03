/**
 * MovementController — Asset Movement & Lifecycle APIs.
 * Reference: API Spec (DOC-10) · FRS FR-MOV-* · BR-MOV-* · ADR-007
 * RBAC: Admin (full) · Asset Manager (create+approve) · Auditor (read) · Dept Manager (view)
 */
import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { MovementService } from '../../application/movement.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateMovementDto, MovementTypeDto } from '../dto/movement.dto';

@Controller()
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class MovementController {
  constructor(private readonly movements: MovementService) {}

  // ---- Create / list / detail ----

  @Post('assets/:id/movements')
  @RequirePermission('movement.create')
  create(@Param('id') assetId: string, @Body() dto: CreateMovementDto, @CurrentUser() user: RequestUser) {
    return this.movements.create(user.tenant_id, {
      tenant_id: user.tenant_id,
      asset_id: assetId,
      movement_type: dto.movement_type,
      to_location_id: dto.to_location_id,
      to_employee_id: dto.to_employee_id,
      from_location_id: dto.from_location_id,
      from_employee_id: dto.from_employee_id,
      reason: dto.reason,
      reference_number: dto.reference_number,
      quantity: dto.quantity,
      notes: dto.notes,
      performed_by: user.sub,
    });
  }

  @Get('assets/:id/movements')
  @RequirePermission('movement.view')
  listByAsset(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.movements.listByAsset(assetId, user.tenant_id);
  }

  @Get('movements')
  @RequirePermission('movement.view')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string, @Query('movement_type') movementType?: MovementTypeDto) {
    return this.movements.list(user.tenant_id, {
      status: status as never,
      movement_type: movementType as never,
    });
  }

  @Get('movements/:id')
  @RequirePermission('movement.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.movements.getById(id, user.tenant_id);
  }

  // ---- Approval workflow ----

  @Patch('movements/:id/approve')
  @RequirePermission('movement.approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.movements.approve(id, user.tenant_id, user.sub);
  }

  @Patch('movements/:id/reject')
  @RequirePermission('movement.reject')
  reject(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.movements.reject(id, user.tenant_id);
  }

  // ---- Lifecycle shortcuts ----

  @Patch('assets/:id/dispose')
  @RequirePermission('movement.create')
  dispose(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.movements.dispose(user.tenant_id, id, user.sub, reason);
  }

  @Patch('assets/:id/retire')
  @RequirePermission('movement.create')
  retire(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.movements.retire(user.tenant_id, id, user.sub, reason);
  }
}

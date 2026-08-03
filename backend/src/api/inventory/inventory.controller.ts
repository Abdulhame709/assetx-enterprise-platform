/**
 * InventoryController — Inventory Cycle & Record APIs.
 * Reference: API Spec (DOC-10) §7 · FRS FR-INV-* · BR-INV-*
 * RBAC: Administrator (full) · Asset Manager (create/manage) · Auditor (read+verify)
 */
import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CycleService } from '../../application/cycle.service';
import { RecordService } from '../../application/record.service';
import { InventoryResultService } from '../../application/inventory-result.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import {
  CreateCycleDto, RecordResultDto, UpdateRecordDto, VerifyRecordDto,
} from '../dto/inventory.dto';

@Controller('inventory')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class InventoryController {
  constructor(
    private readonly cycles: CycleService,
    private readonly records: RecordService,
    private readonly results: InventoryResultService,
  ) {}

  // ---- Cycles ----
  @Post('cycles')
  @RequirePermission('inventory.create')
  create(@Body() dto: CreateCycleDto, @CurrentUser() user: RequestUser) {
    return this.cycles.create(user.tenant_id, dto.year, {
      all: dto.scope?.all,
      location_id: dto.scope?.location_id,
      category_id: dto.scope?.category_id,
    });
  }

  @Get('cycles')
  @RequirePermission('inventory.view')
  list(@CurrentUser() user: RequestUser) {
    return this.cycles.list(user.tenant_id);
  }

  @Get('cycles/:id')
  @RequirePermission('inventory.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.cycles.getById(id, user.tenant_id);
  }

  @Patch('cycles/:id/start')
  @RequirePermission('inventory.execute')
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.cycles.start(id, user.tenant_id);
  }

  @Patch('cycles/:id/close')
  @RequirePermission('inventory.close')
  close(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.cycles.close(id, user.tenant_id);
  }

  // ---- Summary / results ----
  @Get('cycles/:id/summary')
  @RequirePermission('inventory.view')
  summary(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.results.getSummary(id, user.tenant_id);
  }

  @Get('cycles/:id/results')
  @RequirePermission('inventory.view')
  getResults(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.results.getResults(id, user.tenant_id);
  }

  // ---- Records ----
  @Post('cycles/:id/records')
  @RequirePermission('inventory.execute')
  record(@Param('id') id: string, @Body() dto: RecordResultDto, @CurrentUser() user: RequestUser) {
    return this.records.record(id, user.tenant_id, dto.asset_id, {
      actual_location_id: dto.actual_location_id,
      actual_quantity: dto.actual_quantity,
      actual_status_id: dto.actual_status_id,
      actual_employee_id: dto.actual_employee_id,
      notes: dto.notes,
    }, user.sub);
  }

  @Get('cycles/:id/records')
  @RequirePermission('inventory.view')
  listRecords(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.records.listByCycle(id, user.tenant_id);
  }

  @Patch('records/:id')
  @RequirePermission('inventory.execute')
  updateRecord(@Param('id') id: string, @Body() dto: UpdateRecordDto, @CurrentUser() user: RequestUser) {
    return this.records.update(id, user.tenant_id, dto, user.sub);
  }

  @Patch('records/:id/verify')
  @RequirePermission('inventory.verify')
  verify(@Param('id') id: string, @Body() dto: VerifyRecordDto, @CurrentUser() user: RequestUser) {
    return this.records.verify(id, user.tenant_id, dto.verified, user.sub);
  }
}

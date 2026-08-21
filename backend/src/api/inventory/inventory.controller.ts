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
import { assertUuid, assertOptionalUuid } from '../../common/utils/uuid';
import {
  CreateCycleDto, RecordResultDto, UpdateRecordDto, VerifyRecordDto, InventorySyncDto,
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
    assertOptionalUuid(dto.scope?.location_id);
    assertOptionalUuid(dto.scope?.category_id);
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
    assertUuid(id);
    return this.cycles.getById(id, user.tenant_id);
  }

  @Patch('cycles/:id/start')
  @RequirePermission('inventory.execute')
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.cycles.start(id, user.tenant_id);
  }

  @Patch('cycles/:id/close')
  @RequirePermission('inventory.close')
  close(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.cycles.close(id, user.tenant_id);
  }

  // ---- Summary / results ----
  @Get('cycles/:id/summary')
  @RequirePermission('inventory.view')
  summary(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.results.getSummary(id, user.tenant_id);
  }

  @Get('cycles/:id/results')
  @RequirePermission('inventory.view')
  getResults(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.results.getResults(id, user.tenant_id);
  }

  /** Download a minimal cycle snapshot for the offline-first field mobile client. */
  @Get('cycles/:id/mobile-snapshot')
  @RequirePermission('inventory.view')
  mobileSnapshot(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.results.getMobileSnapshot(id, user.tenant_id);
  }

  /** Read-only L1 assistant suggestions; review and movement approval stay human-led. */
  @Get('cycles/:id/location-suggestions')
  @RequirePermission('inventory.view')
  locationSuggestions(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.results.getLocationSuggestions(id, user.tenant_id);
  }

  // ---- Offline field synchronization ----
  @Post('cycles/:id/sync')
  @RequirePermission('inventory.execute')
  async sync(@Param('id') id: string, @Body() dto: InventorySyncDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    const mutations = Array.isArray(dto?.mutations) ? dto.mutations.slice(0, 100) : [];
    const results = await Promise.all(mutations.map(async (mutation) => {
      try {
        assertUuid(mutation.record_id);
        assertUuid(mutation.asset_id);
        const updated = await this.records.sync(
          id,
          mutation.record_id,
          user.tenant_id,
          mutation.asset_id,
          mutation.base_updated_at,
          mutation.payload,
          user.sub,
        );
        return {
          mutation_id: mutation.mutation_id,
          record_id: mutation.record_id,
          status: 'synced' as const,
          updated_at: updated.updated_at,
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : 'SYNC_FAILED';
        return {
          mutation_id: mutation.mutation_id,
          record_id: mutation.record_id,
          status: code === 'SYNC_CONFLICT' ? 'conflict' as const : 'error' as const,
          code,
        };
      }
    }));
    return { cycle_id: id, results };
  }

  // ---- Records ----
  @Post('cycles/:id/records')
  @RequirePermission('inventory.execute')
  record(@Param('id') id: string, @Body() dto: RecordResultDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    assertUuid(dto.asset_id);
    assertOptionalUuid(dto.actual_location_id);
    assertOptionalUuid(dto.actual_status_id);
    assertOptionalUuid(dto.actual_employee_id);
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
    assertUuid(id);
    return this.records.listByCycle(id, user.tenant_id);
  }

  @Patch('records/:id')
  @RequirePermission('inventory.execute')
  updateRecord(@Param('id') id: string, @Body() dto: UpdateRecordDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    assertOptionalUuid(dto.actual_location_id);
    assertOptionalUuid(dto.actual_status_id);
    assertOptionalUuid(dto.actual_employee_id);
    return this.records.update(id, user.tenant_id, dto, user.sub);
  }

  @Patch('records/:id/verify')
  @RequirePermission('inventory.verify')
  verify(@Param('id') id: string, @Body() dto: VerifyRecordDto, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.records.verify(id, user.tenant_id, dto.verified, user.sub);
  }
}

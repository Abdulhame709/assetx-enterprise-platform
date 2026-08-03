/**
 * AssetController — Asset APIs (authenticated, tenant-scoped, RBAC).
 * Reference: API Spec (DOC-10) §4 · FRS FR-ASSET-*
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AssetService } from '../../application/asset.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import {
  AssetQueryDto,
  ChangeStatusDto,
  CreateAssetDto,
  TransferAssetDto,
  UpdateAssetDto,
} from '../dto/asset.dto';

@Controller('assets')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Post()
  @RequirePermission('asset.create')
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: RequestUser) {
    return this.assets.create({
      tenant_id: user.tenant_id,
      name: dto.name,
      description: dto.description,
      category_id: dto.category_id,
      sub_type_id: dto.sub_type_id,
      model_id: dto.model_id,
      location_id: dto.location_id,
      quantity: dto.quantity,
      status_id: dto.status_id,
      employee_id: dto.employee_id,
      purchase_price: dto.purchase_price,
      purchase_date: dto.purchase_date,
      depreciation_rate: dto.depreciation_rate,
      useful_life: dto.useful_life,
      serial_number: dto.serial_number,
      barcode: dto.barcode,
      reference_number: dto.reference_number,
      inventory_year: dto.inventory_year,
      notes: dto.notes,
    });
  }

  @Get()
  @RequirePermission('asset.view')
  search(@Query() query: AssetQueryDto, @CurrentUser() user: RequestUser) {
    return this.assets.search({
      tenant_id: user.tenant_id,
      q: query.q,
      status_id: query.status_id,
      location_id: query.location_id,
      category_id: query.category_id,
      employee_id: query.employee_id,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @RequirePermission('asset.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.assets.getById(id, user.tenant_id);
  }

  @Patch(':id')
  @RequirePermission('asset.update')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: RequestUser) {
    return this.assets.update(id, user.tenant_id, dto);
  }

  @Post(':id/transfer')
  @RequirePermission('asset.transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferAssetDto, @CurrentUser() user: RequestUser) {
    return this.assets.transfer(id, user.tenant_id, {
      to_location_id: dto.to_location_id,
      to_employee_id: dto.to_employee_id,
      to_status_id: dto.to_status_id,
      reason: dto.reason,
      reference_number: dto.reference_number,
      performed_by: user.sub,
    });
  }

  @Patch(':id/status')
  @RequirePermission('asset.update')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: RequestUser) {
    return this.assets.changeStatus(id, user.tenant_id, dto.status_id);
  }
}

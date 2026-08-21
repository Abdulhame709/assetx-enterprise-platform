import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SavedReportTemplateService } from '../../application/saved-report-template.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';
import { ExportFormat, ExportResource } from '../../core/entities/export.entity';
import { ReportDefinition } from '../../core/entities/report.entity';

@Controller('report-templates')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ReportTemplateController {
  constructor(private readonly templates: SavedReportTemplateService) {}

  @Get()
  @RequirePermission('report.view')
  list(@Query('resource') resource: string, @CurrentUser() user: RequestUser) {
    return this.templates.list(user.tenant_id, user.sub, resource || undefined);
  }

  @Get(':id')
  @RequirePermission('report.view')
  getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.templates.getById(user.tenant_id, user.sub, id);
  }

  @Post()
  @RequirePermission('report.create')
  create(@Body() dto: {
    name: string;
    description?: string;
    resource: ExportResource;
    format: ExportFormat;
    definition: ReportDefinition;
    is_shared?: boolean;
  }, @CurrentUser() user: RequestUser) {
    return this.templates.create(user.tenant_id, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermission('report.create')
  update(@Param('id') id: string, @Body() dto: {
    name?: string;
    description?: string | null;
    resource?: ExportResource;
    format?: ExportFormat;
    definition?: ReportDefinition;
    is_shared?: boolean;
  }, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    return this.templates.update(user.tenant_id, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('report.delete')
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    assertUuid(id);
    await this.templates.remove(user.tenant_id, user.sub, id);
    return { message: 'deleted' };
  }
}

/**
 * SettingsController — organization settings (name, logo, report defaults).
 *   GET    /settings            settings.view
 *   PATCH  /settings            settings.update
 *   PUT    /settings/logo       settings.update   { data_uri: "data:image/png;base64,..." }
 *   DELETE /settings/logo       settings.update
 *   GET    /settings/branding   any signed-in user (name + logo shown in the app shell)
 *   GET    /settings/report-designer   settings.view
 *   PUT    /settings/report-designer   settings.update
 */
import { Body, Controller, Delete, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { SettingsService, OrganizationSettingsPatch, ReportDesignerPatch } from '../../application/settings.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('branding')
  async branding(@CurrentUser() user: RequestUser) {
    const { organization_name, logo } = await this.settings.get(user.tenant_id);
    return { organization_name, logo };
  }

  @Get()
  @RequirePermission('settings.view')
  get(@CurrentUser() user: RequestUser) {
    return this.settings.get(user.tenant_id);
  }

  @Patch()
  @RequirePermission('settings.update')
  update(@Body() body: OrganizationSettingsPatch, @CurrentUser() user: RequestUser) {
    return this.settings.update(user.tenant_id, {
      organization_name: body?.organization_name,
      report_signatures: body?.report_signatures,
      report_orientation: body?.report_orientation,
    });
  }

  @Get('report-designer')
  @RequirePermission('settings.view')
  getDesigner(@CurrentUser() user: RequestUser) {
    return this.settings.getDesignerView(user.tenant_id);
  }

  @Put('report-designer')
  @RequirePermission('settings.update')
  updateDesigner(@Body() body: ReportDesignerPatch, @CurrentUser() user: RequestUser) {
    return this.settings.updateDesigner(user.tenant_id, {
      rows_per_page: body?.rows_per_page,
      show_totals: body?.show_totals,
      row_numbers: body?.row_numbers,
      columns: body?.columns,
      widths: body?.widths,
    });
  }

  @Put('logo')
  @RequirePermission('settings.update')
  setLogo(@Body() body: { data_uri?: unknown }, @CurrentUser() user: RequestUser) {
    return this.settings.setLogo(user.tenant_id, body?.data_uri);
  }

  @Delete('logo')
  @RequirePermission('settings.update')
  clearLogo(@CurrentUser() user: RequestUser) {
    return this.settings.clearLogo(user.tenant_id);
  }
}

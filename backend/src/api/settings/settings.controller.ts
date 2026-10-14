/**
 * SettingsController — organization settings (name, logo, report defaults).
 *   GET    /settings            settings.view
 *   PATCH  /settings            settings.update
 *   PUT    /settings/logo       settings.update   { data_uri: "data:image/png;base64,..." }
 *   DELETE /settings/logo       settings.update
 *   GET    /settings/branding   any signed-in user (name + logo shown in the app shell)
 */
import { Body, Controller, Delete, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { SettingsService, OrganizationSettingsPatch } from '../../application/settings.service';
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

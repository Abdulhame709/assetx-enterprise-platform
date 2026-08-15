import { Controller, Get, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AssetImportService, ImportUploadFile } from '../../application/asset-import.service';

@Controller('assets/import')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class AssetImportController {
  constructor(private readonly importer: AssetImportService) {}

  @Get('template')
  @RequirePermission('asset.create')
  async template(@Res() response: Response) {
    const file = await this.importer.createTemplate();
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="assetx-assets-import-template.xlsx"');
    response.send(file);
  }

  @Post('preview')
  @RequirePermission('asset.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  preview(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) {
    return this.importer.preview(file as ImportUploadFile, user.tenant_id);
  }

  @Post('execute')
  @RequirePermission('asset.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  execute(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) {
    return this.importer.importSelected(file as ImportUploadFile, user.tenant_id);
  }
}

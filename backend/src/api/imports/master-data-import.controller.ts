import { Controller, Get, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ImportUploadFile } from '../../application/asset-import.service';
import { MasterDataImportService } from '../../application/master-data-import.service';

@Controller('master-data/import')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class MasterDataImportController {
  constructor(private readonly importer: MasterDataImportService) {}

  @Get('categories/template') @RequirePermission('category.create')
  async categoryTemplate(@Res() response: Response) { return this.template('categories', response); }
  @Post('categories/preview') @RequirePermission('category.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewCategories(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.preview('categories', file as ImportUploadFile, user.tenant_id); }
  @Post('categories/execute') @RequirePermission('category.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  executeCategories(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.importSelected('categories', file as ImportUploadFile, user.tenant_id); }

  @Get('locations/template') @RequirePermission('location.create')
  async locationTemplate(@Res() response: Response) { return this.template('locations', response); }
  @Post('locations/preview') @RequirePermission('location.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewLocations(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.preview('locations', file as ImportUploadFile, user.tenant_id); }
  @Post('locations/execute') @RequirePermission('location.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  executeLocations(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.importSelected('locations', file as ImportUploadFile, user.tenant_id); }

  @Get('statuses/template') @RequirePermission('status.create')
  async statusTemplate(@Res() response: Response) { return this.template('statuses', response); }
  @Post('statuses/preview') @RequirePermission('status.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewStatuses(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.preview('statuses', file as ImportUploadFile, user.tenant_id); }
  @Post('statuses/execute') @RequirePermission('status.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  executeStatuses(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.importSelected('statuses', file as ImportUploadFile, user.tenant_id); }

  @Get('employees/template') @RequirePermission('employee.create')
  async employeeTemplate(@Res() response: Response) { return this.template('employees', response); }
  @Post('employees/preview') @RequirePermission('employee.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewEmployees(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.preview('employees', file as ImportUploadFile, user.tenant_id); }
  @Post('employees/execute') @RequirePermission('employee.create') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  executeEmployees(@UploadedFile() file: ImportUploadFile | undefined, @CurrentUser() user: RequestUser) { return this.importer.importSelected('employees', file as ImportUploadFile, user.tenant_id); }

  private async template(resource: 'categories' | 'locations' | 'statuses' | 'employees', response: Response) {
    const file = await this.importer.createTemplate(resource);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="assetx-${resource}-import-template.xlsx"`);
    response.send(file);
  }
}

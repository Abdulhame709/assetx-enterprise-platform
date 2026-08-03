/**
 * ExportController — export endpoints. Streams files to the client.
 * Each resource has its own endpoint and permission. No business logic;
 * delegates to ExportService. Reference: Phase 11.3
 */
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../../application/export.service';
import { ExportFormat } from '../../core/entities/export.entity';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('exports')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('assets')
  @RequirePermission('export.assets')
  assets(@Query('format') format: ExportFormat, @Query('limit') limit: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('assets', format, limit, u, res);
  }

  @Get('movements')
  @RequirePermission('export.movements')
  movements(@Query('format') format: ExportFormat, @Query('limit') limit: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('movements', format, limit, u, res);
  }

  @Get('inventory')
  @RequirePermission('export.inventory')
  inventory(@Query('format') format: ExportFormat, @Query('limit') limit: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('inventory', format, limit, u, res);
  }

  @Get('audit')
  @RequirePermission('export.audit')
  audit(@Query('format') format: ExportFormat, @Query('limit') limit: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('audit', format, limit, u, res);
  }

  @Get('dashboard')
  @RequirePermission('export.dashboard')
  dashboard(@Query('format') format: ExportFormat, @Query('limit') limit: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('dashboard', format, limit, u, res);
  }

  private async stream(resource: string, format: ExportFormat, limit: string, u: RequestUser, res: Response): Promise<void> {
    const fmt: ExportFormat = format ?? 'csv';
    const result = await this.exports.generate({
      tenant_id: u.tenant_id,
      userId: u.sub,
      resource: resource as never,
      format: fmt,
      options: { limit: limit ? Number(limit) : 10000, includeHeaders: true },
    });
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    result.stream.pipe(res);
  }
}

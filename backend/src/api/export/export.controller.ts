/**
 * ExportController — export endpoints. Streams files to the client.
 * Each resource has its own endpoint and permission. No business logic;
 * delegates to ExportService. Reference: Phase 11.3
 */
import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../../application/export.service';
import { ExportColumn, ExportFormat } from '../../core/entities/export.entity';
import { ExportProfileId } from '../../core/entities/export-profile.entity';
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
  assets(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('assets', format, limit, profile, columns, u, res);
  }

  @Get('movements')
  @RequirePermission('export.movements')
  movements(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('movements', format, limit, profile, columns, u, res);
  }

  @Get('inventory')
  @RequirePermission('export.inventory')
  inventory(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('inventory', format, limit, profile, columns, u, res);
  }

  @Get('audit')
  @RequirePermission('export.audit')
  audit(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('audit', format, limit, profile, columns, u, res);
  }

  @Get('dashboard')
  @RequirePermission('export.dashboard')
  dashboard(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('dashboard', format, limit, profile, columns, u, res);
  }

  private async stream(resource: string, format: ExportFormat, limit: string, profile: string, columns: string, u: RequestUser, res: Response): Promise<void> {
    const fmt: ExportFormat = format ?? 'csv';
    const parsedProfile = this.parseProfile(profile);
    const parsedColumns = this.parseColumns(columns);
    const result = await this.exports.generate({
      tenant_id: u.tenant_id,
      userId: u.sub,
      resource: resource as never,
      format: fmt,
      options: {
        limit: limit ? Number(limit) : 10000,
        includeHeaders: true,
        ...(parsedProfile ? { profile: parsedProfile } : {}),
        ...(parsedColumns ? { columns: parsedColumns } : {}),
      },
    });
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    result.stream.pipe(res);
  }

  private parseProfile(value?: string): ExportProfileId | undefined {
    if (!value) return undefined;
    const allowed: ExportProfileId[] = ['executive', 'finance', 'auditor', 'inventory', 'compliance'];
    if (!allowed.includes(value as ExportProfileId)) throw new BadRequestException('INVALID_EXPORT_PROFILE');
    return value as ExportProfileId;
  }

  private parseColumns(value?: string): ExportColumn[] | undefined {
    if (!value) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('INVALID_EXPORT_COLUMNS');
    }
    if (!Array.isArray(parsed) || parsed.length > 40) throw new BadRequestException('INVALID_EXPORT_COLUMNS');
    const columns = parsed.map((item): ExportColumn => {
      if (!item || typeof item !== 'object') throw new BadRequestException('INVALID_EXPORT_COLUMNS');
      const candidate = item as Record<string, unknown>;
      const key = String(candidate.key ?? '');
      const label = candidate.label == null ? undefined : String(candidate.label);
      const order = candidate.order == null ? undefined : Number(candidate.order);
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || (label && label.length > 120) || (order !== undefined && !Number.isInteger(order))) {
        throw new BadRequestException('INVALID_EXPORT_COLUMNS');
      }
      return { key, ...(label ? { label } : {}), ...(order !== undefined ? { order } : {}) };
    });
    if (new Set(columns.map((column) => column.key)).size !== columns.length) throw new BadRequestException('INVALID_EXPORT_COLUMNS');
    return columns;
  }
}

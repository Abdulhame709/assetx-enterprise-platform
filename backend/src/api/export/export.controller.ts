/**
 * ExportController — export endpoints. Streams files to the client.
 * Each resource has its own endpoint and permission. No business logic;
 * delegates to ExportService. Reference: Phase 11.3
 */
import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../../application/export.service';
import { ExportColumn, ExportFormat } from '../../core/entities/export.entity';
import { ReportAggregation, ReportGroup, ReportSort } from '../../core/entities/report.entity';
import { ExportProfileId } from '../../core/entities/export-profile.entity';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

const SAFE_FIELD = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const VALID_AGGREGATIONS: ReportAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];

@Controller('exports')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('assets')
  @RequirePermission('export.assets')
  assets(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @Query('sorting') sorting: string, @Query('grouping') grouping: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('assets', format, limit, profile, columns, sorting, grouping, u, res);
  }

  @Get('movements')
  @RequirePermission('export.movements')
  movements(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @Query('sorting') sorting: string, @Query('grouping') grouping: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('movements', format, limit, profile, columns, sorting, grouping, u, res);
  }

  @Get('inventory')
  @RequirePermission('export.inventory')
  inventory(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @Query('sorting') sorting: string, @Query('grouping') grouping: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('inventory', format, limit, profile, columns, sorting, grouping, u, res);
  }

  @Get('audit')
  @RequirePermission('export.audit')
  audit(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @Query('sorting') sorting: string, @Query('grouping') grouping: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('audit', format, limit, profile, columns, sorting, grouping, u, res);
  }

  @Get('dashboard')
  @RequirePermission('export.dashboard')
  dashboard(@Query('format') format: ExportFormat, @Query('limit') limit: string, @Query('profile') profile: string, @Query('columns') columns: string, @Query('sorting') sorting: string, @Query('grouping') grouping: string, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('dashboard', format, limit, profile, columns, sorting, grouping, u, res);
  }

  private async stream(resource: string, format: ExportFormat, limit: string, profile: string, columns: string, sorting: string, grouping: string, u: RequestUser, res: Response): Promise<void> {
    const fmt: ExportFormat = format ?? 'csv';
    const parsedProfile = this.parseProfile(profile);
    const parsedColumns = this.parseColumns(columns);
    const parsedSorting = this.parseSorting(sorting);
    const parsedGrouping = this.parseGrouping(grouping);
    const reportMetadata = this.buildReportMetadata(parsedColumns, parsedSorting, parsedGrouping);
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
        ...(reportMetadata ? { filters: { __report: reportMetadata } } : {}),
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

  private parseSorting(value?: string): ReportSort[] | undefined {
    if (!value) return undefined;
    const parsed = this.parseJsonArray(value, 'INVALID_EXPORT_SORTING', 10);
    return parsed.map((item) => {
      const candidate = this.objectOf(item, 'INVALID_EXPORT_SORTING');
      const field = String(candidate.field ?? '');
      const dir = candidate.dir;
      if (!SAFE_FIELD.test(field) || (dir !== 'asc' && dir !== 'desc')) throw new BadRequestException('INVALID_EXPORT_SORTING');
      return { field, dir };
    });
  }

  private parseGrouping(value?: string): ReportGroup[] | undefined {
    if (!value) return undefined;
    const parsed = this.parseJsonArray(value, 'INVALID_EXPORT_GROUPING', 10);
    return parsed.map((item) => {
      const candidate = this.objectOf(item, 'INVALID_EXPORT_GROUPING');
      const field = String(candidate.field ?? '');
      const aggregate = candidate.aggregate == null ? undefined : String(candidate.aggregate) as ReportAggregation;
      const valueField = candidate.valueField == null ? undefined : String(candidate.valueField);
      if (!SAFE_FIELD.test(field) || (aggregate !== undefined && !VALID_AGGREGATIONS.includes(aggregate)) || (valueField !== undefined && !SAFE_FIELD.test(valueField))) {
        throw new BadRequestException('INVALID_EXPORT_GROUPING');
      }
      return { field, ...(aggregate ? { aggregate } : {}), ...(valueField ? { valueField } : {}) };
    });
  }

  private buildReportMetadata(columns?: ExportColumn[], sorting?: ReportSort[], grouping?: ReportGroup[]) {
    if (!sorting && !grouping) return undefined;
    const fallback = [...(sorting ?? []).map((s) => s.field), ...(grouping ?? []).flatMap((g) => [g.field, ...(g.valueField ? [g.valueField] : [])])];
    const fields = columns?.map((column) => column.key) ?? [...new Set(fallback)];
    return {
      columns: fields.map((field) => {
        const column = columns?.find((candidate) => candidate.key === field);
        return { field, ...(column?.label ? { label: column.label } : {}) };
      }),
      sorting: sorting ?? [],
      grouping: grouping ?? [],
    };
  }

  private parseJsonArray(value: string, error: string, max: number): unknown[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException(error);
    }
    if (!Array.isArray(parsed) || parsed.length > max) throw new BadRequestException(error);
    return parsed;
  }

  private objectOf(value: unknown, error: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(error);
    return value as Record<string, unknown>;
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

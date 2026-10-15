/**
 * ExportController — export endpoints. Streams files to the client.
 * Each resource has its own endpoint and permission. No business logic;
 * delegates to ExportService. Reference: Phase 11.3
 *
 * Report center additions: asset-derived reports (assets, asset-locations,
 * asset-types, duplicates, inventory-form) accept filters (location, type,
 * status, employee, search, sort) and a JSON preview endpoint.
 */
import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../../application/export.service';
import { ReportFilterInput, ReportMetaService } from '../../application/export/report-meta.service';
import { isAssetSortKey } from '../../application/export/export-sort';
import { contentDisposition } from './content-disposition';
import { ExportColumn, ExportFormat, ExportOptions, ExportResource } from '../../core/entities/export.entity';
import { ReportAggregation, ReportGroup, ReportSort } from '../../core/entities/report.entity';
import { ExportProfileId } from '../../core/entities/export-profile.entity';
import { isGroupRow } from '../../core/constants/report-groups';
import { RESOURCE_TITLES, ReportLang, columnLabel } from '../../core/constants/export-labels';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

const SAFE_FIELD = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_AGGREGATIONS: ReportAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];
const MAX_BLANK_ROWS = 500;
const MAX_SUMMARY = 2000;
const PREVIEW_ROWS = 200;

type FilterKey = keyof ReportFilterInput;

/** Which filters each asset-derived report understands (others are ignored, never printed). */
const FILTER_KEYS: Partial<Record<ExportResource, FilterKey[]>> = {
  assets: ['location_id', 'category_id', 'status_id', 'employee_id', 'no_employee', 'q', 'group_by', 'sort_by', 'sort_dir'],
  'inventory-form': ['location_id', 'category_id', 'status_id', 'employee_id', 'no_employee', 'q', 'blank_rows', 'group_by', 'sort_by', 'sort_dir'],
  'asset-locations': ['location_id', 'location_scope'],
  'asset-types': ['location_id', 'status_id'],
  duplicates: ['category_id'],
};

type QueryParams = Record<string, unknown>;

@Controller('exports')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ExportController {
  constructor(private readonly exports: ExportService, private readonly reportMeta: ReportMetaService) {}

  @Get('assets')
  @RequirePermission('export.assets')
  assets(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('assets', q, u, res);
  }

  @Get('asset-locations')
  @RequirePermission('export.assets')
  assetLocations(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('asset-locations', q, u, res);
  }

  @Get('asset-types')
  @RequirePermission('export.assets')
  assetTypes(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('asset-types', q, u, res);
  }

  @Get('duplicates')
  @RequirePermission('export.assets')
  duplicates(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('duplicates', q, u, res);
  }

  @Get('inventory-form')
  @RequirePermission('export.assets')
  inventoryForm(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('inventory-form', q, u, res);
  }

  @Get('movements')
  @RequirePermission('export.movements')
  movements(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('movements', q, u, res);
  }

  @Get('inventory')
  @RequirePermission('export.inventory')
  inventory(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('inventory', q, u, res);
  }

  @Get('audit')
  @RequirePermission('export.audit')
  audit(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('audit', q, u, res);
  }

  @Get('dashboard')
  @RequirePermission('export.dashboard')
  dashboard(@Query() q: QueryParams, @CurrentUser() u: RequestUser, @Res() res: Response) {
    return this.stream('dashboard', q, u, res);
  }

  /** On-screen preview of an asset-derived report: same filters as the file, first rows only. */
  @Get('preview/:resource')
  @RequirePermission('export.assets')
  async preview(@Param('resource') resource: string, @Query() q: QueryParams, @CurrentUser() u: RequestUser) {
    if (!(resource in FILTER_KEYS)) throw new BadRequestException('INVALID_EXPORT_RESOURCE');
    const res = resource as ExportResource;
    const lang: ReportLang = q.lang === 'en' ? 'en' : 'ar';
    try {
      const { meta, options } = await this.plan(res, q, u, 10000);
      const { rows, total, columns } = await this.exports.preview({
        tenant_id: u.tenant_id,
        resource: res,
        options,
      }, PREVIEW_ROWS);
      // eslint-disable-next-line no-console
      console.log(`[ExportController] preview ${resource}: ${rows.length} rows, total ${total}, filters ${JSON.stringify(options.filters ?? {}).slice(0, 400)}`);
      const firstDetail = rows.find((row) => !isGroupRow(row));
      const shown: ExportColumn[] = columns && columns.length > 0
        ? [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : Object.keys(firstDetail ?? {}).map((key) => ({ key }));
      const keys = shown.map((c) => c.key);
      const detailShown = rows.filter((row) => !isGroupRow(row)).length;
      return {
        resource: res,
        title: meta.title ?? RESOURCE_TITLES[res]?.[lang] ?? res,
        organizationName: meta.organizationName ?? '',
        filtersText: meta.filtersText ?? '',
        columns: shown.map((c) => ({ key: c.key, label: columnLabel(c.key, c.label, lang) })),
        // Location bands travel as { __group, __level, __count } so the screen can draw them like the file does.
        rows: rows.map((row) => (isGroupRow(row)
          ? { __group: row.__group, __level: row.__level, __count: row.__count }
          : Object.fromEntries(keys.map((key) => [key, row[key] ?? ''])))),
        total,
        truncated: total > detailShown,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // eslint-disable-next-line no-console
      console.error(`[ExportController] ${resource} preview failed:`, err);
      throw new BadRequestException(`EXPORT_FAILED: ${(err as Error)?.message ?? 'unknown error'}`);
    }
  }

  private async stream(resource: ExportResource, q: QueryParams, u: RequestUser, res: Response): Promise<void> {
    const fmt: ExportFormat = (str(q.format) as ExportFormat | undefined) ?? 'csv';
    const limit = str(q.limit);
    let result;
    let title: string | undefined;
    try {
      const planned = await this.plan(resource, q, u, limit ? Number(limit) : 10000);
      const options = planned.options;
      title = planned.meta.title;
      result = await this.exports.generate({
        tenant_id: u.tenant_id,
        userId: u.sub,
        resource: resource as never,
        format: fmt,
        options,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // Surface the real reason (e.g. DB/SQL errors) so a failed export is
      // diagnosable instead of a generic 500.
      const reason = (err as Error)?.message ?? 'unknown export error';
      // eslint-disable-next-line no-console
      console.error(`[ExportController] ${resource}/${fmt} export failed:`, err);
      throw new BadRequestException(`EXPORT_FAILED: ${reason}`);
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(result.filename, title));
    result.stream.pipe(res);
  }

  /**
   * Everything a report needs, from the query string: filters, columns, sorting,
   * grouping and the header context. Shared by the file download and the preview so
   * the screen shows what the file will contain. Nothing chosen = all (no filter).
   */
  private async plan(resource: ExportResource, q: QueryParams, u: RequestUser, limit: number) {
    const profile = this.parseProfile(str(q.profile));
    let columns = this.parseColumns(str(q.columns));
    const sorting = this.parseSorting(str(q.sorting));
    const grouping = this.parseGrouping(str(q.grouping));
    const filters = this.parseFilters(resource, q);
    const summary = this.parseSummary(q.summary);
    const meta = await this.reportMeta.build({
      tenantId: u.tenant_id,
      userName: u.username,
      resource,
      lang: str(q.lang),
      profile,
      columns,
      sorting,
      grouping,
      filters,
      summary,
    });
    // No columns named (and no summary-style grouping): print the ones set in the Report Designer.
    if (!columns && !profile && !(grouping && grouping.length > 0)) {
      columns = await this.reportMeta.defaultColumns(u.tenant_id, resource);
    }
    if (resource === 'assets') {
      columns = this.withFilterColumns(columns, grouping, filters);
      // Filtering by type/status/employee: list the assets location by location unless told otherwise.
      if (!filters.sort_by && !(sorting && sorting.length > 0) && this.filtersByOtherThanLocation(filters)) filters.sort_by = 'location';
    }
    const report = this.buildReportMetadata(columns, sorting, grouping, filters.group_by === 'location');
    const options: ExportOptions = {
      limit,
      includeHeaders: true,
      meta,
      ...(profile ? { profile } : {}),
      ...(columns ? { columns } : {}),
      ...(report || Object.keys(filters).length > 0
        ? { filters: { ...filters, ...(report ? { __report: report } : {}) } }
        : {}),
    };
    return { meta, options };
  }

  private filtersByOtherThanLocation(f: ReportFilterInput): boolean {
    return Boolean(f.category_id || f.status_id || f.employee_id || f.no_employee);
  }

  /**
   * A report filtered by type, status or custodian always shows the location name
   * (and the column it is filtered on), so the page explains where each asset is.
   */
  private withFilterColumns(columns: ExportColumn[] | undefined, grouping: ReportGroup[] | undefined, f: ReportFilterInput): ExportColumn[] | undefined {
    if (!columns || (grouping && grouping.length > 0) || !this.filtersByOtherThanLocation(f)) return columns;
    const wanted = ['location_name'];
    if (f.category_id) wanted.push('category_name');
    if (f.status_id) wanted.push('status_name');
    if (f.employee_id || f.no_employee) wanted.push('employee_name');
    const out = [...columns];
    for (const key of wanted) {
      if (!out.some((c) => c.key === key)) out.push({ key, order: Math.max(0, ...out.map((c) => c.order ?? 0)) + 1 });
    }
    return out;
  }

  /** Only the filters the report understands; a malformed id is rejected, not silently ignored. */
  private parseFilters(resource: ExportResource, q: QueryParams): ReportFilterInput {
    const allowed = FILTER_KEYS[resource];
    if (!allowed) return {};
    const out: ReportFilterInput = {};
    const bad = () => new BadRequestException('INVALID_EXPORT_FILTER');
    const uuid = (key: 'location_id' | 'category_id' | 'status_id') => {
      const value = str(q[key]);
      if (!value || !allowed.includes(key)) return;
      if (!UUID.test(value)) throw bad();
      out[key] = value;
    };
    uuid('location_id');
    uuid('category_id');
    uuid('status_id');
    const employee = str(q.employee_id);
    if (employee && allowed.includes('employee_id')) {
      if (employee === 'none') out.no_employee = true;
      else if (UUID.test(employee)) out.employee_id = employee;
      else throw bad();
    }
    const search = str(q.q)?.trim();
    if (search && allowed.includes('q')) {
      if (search.length > 100) throw bad();
      out.q = search;
    }
    const scope = str(q.location_scope);
    if (scope && allowed.includes('location_scope')) {
      if (scope !== 'main' && scope !== 'sub') throw bad();
      out.location_scope = scope;
    }
    const blank = str(q.blank_rows);
    if (blank && allowed.includes('blank_rows')) {
      const n = Number(blank);
      if (!Number.isInteger(n) || n < 0 || n > MAX_BLANK_ROWS) throw bad();
      if (n > 0) out.blank_rows = n;
    }
    const groupBy = str(q.group_by);
    if (groupBy && groupBy !== 'none' && allowed.includes('group_by')) {
      if (groupBy !== 'location') throw bad();
      out.group_by = 'location';
    }
    const sortBy = str(q.sort_by);
    if (sortBy && allowed.includes('sort_by')) {
      if (!isAssetSortKey(sortBy)) throw bad();
      out.sort_by = sortBy;
      const dir = str(q.sort_dir);
      if (dir !== undefined && dir !== 'asc' && dir !== 'desc') throw bad();
      if (dir === 'asc' || dir === 'desc') out.sort_dir = dir;
    }
    return out;
  }

  private parseSummary(value: unknown): string | undefined {
    const text = str(value)?.trim();
    if (!text) return undefined;
    if (text.length > MAX_SUMMARY) throw new BadRequestException('INVALID_EXPORT_SUMMARY');
    return text;
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

  private buildReportMetadata(columns?: ExportColumn[], sorting?: ReportSort[], grouping?: ReportGroup[], byLocation = false) {
    if (!sorting && !grouping) return undefined;
    const fallback = [...(sorting ?? []).map((s) => s.field), ...(grouping ?? []).flatMap((g) => [g.field, ...(g.valueField ? [g.valueField] : [])])];
    const fields = columns?.map((column) => column.key) ?? [...new Set(fallback)];
    // The location bands are built from the location column, so it must survive the projection.
    if (byLocation && !fields.includes('location_name')) fields.push('location_name');
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

/** A query value as a single string (repeated params arrive as arrays and are ignored). */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

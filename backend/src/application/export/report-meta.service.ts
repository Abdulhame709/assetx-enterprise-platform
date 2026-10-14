/**
 * ReportMetaService — gathers the presentation context printed on a report:
 * organization name/logo (settings table, falling back to the tenant name),
 * who produced it, when, in which language, a one-line description of the
 * filters/sorting/grouping applied, and the Report Designer options (rows per
 * page, totals, row numbers). Read-only; no business logic.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_DESIGNER, ReportDesignerSettings, ReportOrientation, SettingsService, decodeLogo,
} from '../settings.service';
import { ExportColumn, ExportMeta, ExportResource } from '../../core/entities/export.entity';
import { ReportGroup, ReportSort } from '../../core/entities/report.entity';
import {
  AGGREGATE_NAMES, PROFILE_NAMES, RESOURCE_TITLES, ReportLang, columnLabel,
} from '../../core/constants/export-labels';
import { defaultColumnsFor } from '../../core/constants/report-catalog';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';
import { loadNameMaps, nameOf, statusName } from './export-lookups';

/** Filters the report center can apply (the same names the export endpoints accept). */
export interface ReportFilterInput {
  location_id?: string;
  location_scope?: 'main' | 'sub';
  category_id?: string;
  status_id?: string;
  employee_id?: string;
  no_employee?: boolean;
  q?: string;
  blank_rows?: number;
  group_by?: 'location';
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface ReportMetaInput {
  tenantId: string;
  userName: string;
  resource: ExportResource;
  lang?: string;
  profile?: string;
  columns?: ExportColumn[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
  filters?: ReportFilterInput;
  /** optional narrative (e.g. the AI summary) printed above the table */
  summary?: string;
}

const TEXT = {
  ar: {
    profile: 'النمط', grouped: 'التجميع', sorted: 'الترتيب', asc: 'تصاعدي', desc: 'تنازلي',
    location: 'الموقع', category: 'نوع الأصل', status: 'الحالة', employee: 'الموظف', noEmployee: 'الأصول غير المرتبطة بموظف',
    search: 'بحث', scope: 'نطاق المواقع', main: 'الرئيسية فقط', sub: 'الفرعية فقط', blank: 'نموذج فارغ', lines: 'سطر',
    sort: 'الترتيب حسب', groupByLocation: 'التجميع: حسب الموقع (رئيسي ← فرعي ← أصول)',
    sortKeys: {
      location: 'الموقع', category: 'نوع الأصل', name: 'اسم الأصل', status: 'الحالة', employee: 'الموظف', code: 'الرمز', price: 'السعر',
    } as Record<string, string>,
  },
  en: {
    profile: 'Profile', grouped: 'Grouped by', sorted: 'Sorted by', asc: 'asc', desc: 'desc',
    location: 'Location', category: 'Asset type', status: 'Status', employee: 'Custodian', noEmployee: 'Assets without a custodian',
    search: 'Search', scope: 'Locations', main: 'Main only', sub: 'Sub-locations only', blank: 'Blank form', lines: 'lines',
    sort: 'Sort by', groupByLocation: 'Grouped by location (main → sub → assets)',
    sortKeys: {
      location: 'Location', category: 'Asset type', name: 'Asset name', status: 'Status', employee: 'Custodian', code: 'Code', price: 'Price',
    } as Record<string, string>,
  },
};

@Injectable()
export class ReportMetaService {
  constructor(
    private readonly settings: SettingsService,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async build(input: ReportMetaInput): Promise<ExportMeta> {
    const lang: ReportLang = input.lang === 'en' ? 'en' : 'ar';
    const { organizationName, logo, signatures, orientation } = await this.loadOrganization(input.tenantId);
    const designer = await this.loadDesigner(input.tenantId);
    const filtersText = await this.describe(input, lang);
    const isForm = input.resource === 'inventory-form';
    return {
      resource: input.resource,
      title: RESOURCE_TITLES[input.resource]?.[lang] ?? input.resource,
      ...(organizationName ? { organizationName } : {}),
      ...(logo ? { logo } : {}),
      userName: input.userName,
      ...(filtersText ? { filtersText } : {}),
      generatedAt: new Date().toISOString(),
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      orientation: isForm && orientation === 'auto' ? 'landscape' : orientation,
      ...(input.summary ? { summary: input.summary } : {}),
      ...(signatures ? { signatures: true } : {}),
      ...(designer.rows_per_page > 0 ? { rowsPerPage: designer.rows_per_page } : {}),
      showTotals: isForm ? false : designer.show_totals,
      ...(designer.row_numbers ? { rowNumbers: true } : {}),
      ...(isForm ? { formMode: true } : {}),
      ...(designer.widths[input.resource] ? { columnWidths: designer.widths[input.resource] } : {}),
    };
  }

  /** The columns a report prints when the caller names none: the designer's choice, else the catalog defaults. */
  async defaultColumns(tenantId: string, resource: ExportResource): Promise<ExportColumn[] | undefined> {
    const designer = await this.loadDesigner(tenantId);
    const keys = defaultColumnsFor(resource, designer.columns[resource]);
    return keys?.map((key, order) => ({ key, order }));
  }

  private async loadDesigner(tenantId: string): Promise<ReportDesignerSettings> {
    try {
      return await this.settings.getDesigner(tenantId);
    } catch {
      return DEFAULT_DESIGNER;
    }
  }

  private async loadOrganization(tenantId: string): Promise<{
    organizationName?: string; logo?: Buffer; signatures: boolean; orientation: ReportOrientation;
  }> {
    try {
      const settings = await this.settings.get(tenantId);
      const logo = settings.logo ? decodeLogo(settings.logo)?.bytes : undefined;
      return {
        organizationName: settings.organization_name || undefined,
        logo,
        signatures: settings.report_signatures,
        orientation: settings.report_orientation,
      };
    } catch {
      // The report header is cosmetic: never fail an export because of it.
      return { signatures: false, orientation: 'auto' };
    }
  }

  private async describe(input: ReportMetaInput, lang: ReportLang): Promise<string> {
    const tx = TEXT[lang];
    const parts: string[] = [];
    const label = (key: string) => columnLabel(key, input.columns?.find((c) => c.key === key)?.label, lang);
    if (input.profile && PROFILE_NAMES[input.profile]) {
      parts.push(`${tx.profile}: ${PROFILE_NAMES[input.profile][lang]}`);
    }
    parts.push(...await this.describeFilters(input, lang));
    if (input.grouping && input.grouping.length > 0) {
      const groups = input.grouping.map((g) => {
        const aggregate = AGGREGATE_NAMES[g.aggregate ?? 'count']?.[lang] ?? g.aggregate ?? '';
        const value = g.valueField ? ` (${label(g.valueField)})` : '';
        return `${label(g.field)} — ${aggregate}${value}`;
      });
      parts.push(`${tx.grouped}: ${groups.join('، ')}`);
    }
    if (input.sorting && input.sorting.length > 0) {
      const sorts = input.sorting.map((s) => `${label(s.field)} ${s.dir === 'desc' ? tx.desc : tx.asc}`);
      parts.push(`${tx.sorted}: ${sorts.join('، ')}`);
    }
    return parts.join('   |   ');
  }

  /** One short phrase per applied filter, with names (not ids) so the printed page explains itself. */
  private async describeFilters(input: ReportMetaInput, lang: ReportLang): Promise<string[]> {
    const f = input.filters;
    if (!f) return [];
    const tx = TEXT[lang];
    const parts: string[] = [];
    const needsNames = Boolean(f.location_id || f.category_id || f.status_id || f.employee_id);
    let names: Awaited<ReturnType<typeof loadNameMaps>> | undefined;
    if (needsNames) {
      try {
        names = await loadNameMaps(this.db, input.tenantId);
      } catch {
        names = undefined;
      }
    }
    if (f.blank_rows && f.blank_rows > 0) parts.push(`${tx.blank}: ${f.blank_rows} ${tx.lines}`);
    if (f.location_scope) parts.push(`${tx.scope}: ${f.location_scope === 'main' ? tx.main : tx.sub}`);
    // Never print a raw id: a filter whose name cannot be resolved is simply not described.
    const named = (title: string, name: string | undefined) => { if (name) parts.push(`${title}: ${name}`); };
    if (f.location_id) named(tx.location, names && nameOf(names.locations, f.location_id));
    if (f.category_id) named(tx.category, names && nameOf(names.categories, f.category_id));
    if (f.status_id) named(tx.status, names && statusName(names.statuses, f.status_id));
    if (f.no_employee) parts.push(tx.noEmployee);
    else if (f.employee_id) named(tx.employee, names && nameOf(names.employees, f.employee_id));
    if (f.q) parts.push(`${tx.search}: ${f.q}`);
    if (f.group_by === 'location') parts.push(tx.groupByLocation);
    if (f.sort_by && tx.sortKeys[f.sort_by]) {
      parts.push(`${tx.sort}: ${tx.sortKeys[f.sort_by]} ${f.sort_dir === 'desc' ? tx.desc : tx.asc}`);
    }
    return parts;
  }
}

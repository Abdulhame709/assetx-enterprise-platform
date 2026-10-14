/**
 * ReportMetaService — gathers the presentation context printed on a report:
 * organization name/logo (settings table, falling back to the tenant name),
 * who produced it, when, in which language, and a one-line description of the
 * sorting/grouping applied. Read-only; no business logic.
 */
import { Injectable } from '@nestjs/common';
import { ReportOrientation, SettingsService, decodeLogo } from '../settings.service';
import { ExportColumn, ExportMeta, ExportResource } from '../../core/entities/export.entity';
import { ReportGroup, ReportSort } from '../../core/entities/report.entity';
import {
  AGGREGATE_NAMES, PROFILE_NAMES, RESOURCE_TITLES, ReportLang, columnLabel,
} from '../../core/constants/export-labels';

export interface ReportMetaInput {
  tenantId: string;
  userName: string;
  resource: ExportResource;
  lang?: string;
  profile?: string;
  columns?: ExportColumn[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
}

@Injectable()
export class ReportMetaService {
  constructor(private readonly settings: SettingsService) {}

  async build(input: ReportMetaInput): Promise<ExportMeta> {
    const lang: ReportLang = input.lang === 'en' ? 'en' : 'ar';
    const { organizationName, logo, signatures, orientation } = await this.loadOrganization(input.tenantId);
    const filtersText = this.describe(input, lang);
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
      orientation,
      ...(signatures ? { signatures: true } : {}),
    };
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

  private describe(input: ReportMetaInput, lang: ReportLang): string {
    const parts: string[] = [];
    const label = (key: string) => columnLabel(key, input.columns?.find((c) => c.key === key)?.label, lang);
    if (input.profile && PROFILE_NAMES[input.profile]) {
      parts.push(`${lang === 'ar' ? 'النمط' : 'Profile'}: ${PROFILE_NAMES[input.profile][lang]}`);
    }
    if (input.grouping && input.grouping.length > 0) {
      const groups = input.grouping.map((g) => {
        const aggregate = AGGREGATE_NAMES[g.aggregate ?? 'count']?.[lang] ?? g.aggregate ?? '';
        const value = g.valueField ? ` (${label(g.valueField)})` : '';
        return `${label(g.field)} — ${aggregate}${value}`;
      });
      parts.push(`${lang === 'ar' ? 'التجميع' : 'Grouped by'}: ${groups.join('، ')}`);
    }
    if (input.sorting && input.sorting.length > 0) {
      const sorts = input.sorting.map((s) => {
        const dir = s.dir === 'desc' ? (lang === 'ar' ? 'تنازلي' : 'desc') : (lang === 'ar' ? 'تصاعدي' : 'asc');
        return `${label(s.field)} ${dir}`;
      });
      parts.push(`${lang === 'ar' ? 'الترتيب' : 'Sorted by'}: ${sorts.join('، ')}`);
    }
    return parts.join('   |   ');
  }
}

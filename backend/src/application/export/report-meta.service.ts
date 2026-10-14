/**
 * ReportMetaService — gathers the presentation context printed on a report:
 * organization name/logo (settings table, falling back to the tenant name),
 * who produced it, when, in which language, and a one-line description of the
 * sorting/grouping applied. Read-only; no business logic.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';
import { ExportColumn, ExportMeta, ExportResource } from '../../core/entities/export.entity';
import { ReportGroup, ReportSort } from '../../core/entities/report.entity';
import {
  AGGREGATE_NAMES, PROFILE_NAMES, RESOURCE_TITLES, ReportLang, columnLabel,
} from '../../core/constants/export-labels';

const MAX_LOGO_BYTES = 1024 * 1024;

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
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async build(input: ReportMetaInput): Promise<ExportMeta> {
    const lang: ReportLang = input.lang === 'en' ? 'en' : 'ar';
    const { organizationName, logo } = await this.loadOrganization(input.tenantId);
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
      orientation: 'auto',
    };
  }

  private async loadOrganization(tenantId: string): Promise<{ organizationName?: string; logo?: Buffer }> {
    let organizationName: string | undefined;
    let logo: Buffer | undefined;
    try {
      const settings = await this.db.queryAsTenant<{ setting_key: string; setting_value: string | null }>(
        tenantId,
        `SELECT setting_key, setting_value FROM settings
         WHERE tenant_id = $1 AND setting_key IN ('organization_name', 'organization_logo')`,
        [tenantId],
      );
      for (const row of settings.rows) {
        if (row.setting_key === 'organization_name' && row.setting_value?.trim()) organizationName = row.setting_value.trim();
        if (row.setting_key === 'organization_logo' && row.setting_value) logo = this.decodeLogo(row.setting_value);
      }
      if (!organizationName) {
        const tenant = await this.db.query<{ name: string }>(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
        organizationName = tenant.rows[0]?.name;
      }
    } catch {
      // The report header is cosmetic: never fail an export because of it.
    }
    return { organizationName, logo };
  }

  /** Accepts a PNG/JPEG data URI or raw base64; anything else is ignored. */
  private decodeLogo(value: string): Buffer | undefined {
    const base64 = value.replace(/^data:image\/(png|jpe?g);base64,/i, '').trim();
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return undefined;
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return undefined;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return isPng || isJpeg ? bytes : undefined;
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

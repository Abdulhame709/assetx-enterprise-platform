/**
 * SettingsService — organization-wide settings kept in the key/value `settings` table:
 * official name, logo (PNG/JPEG), and report defaults. Everything here is read by the
 * report generators and the web shell, so a change applies across the whole system.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { DATABASE_PORT } from '../core/ports/tokens';
import { DomainError } from '../common/http/domain-error';
import { ExportResource } from '../core/entities/export.entity';
import { REPORT_CATALOG, ReportCatalogEntry, isDesignableResource } from '../core/constants/report-catalog';
import { COLUMN_LABELS, ReportLang, RESOURCE_TITLES } from '../core/constants/export-labels';

export const SETTING_KEYS = {
  name: 'organization_name',
  logo: 'organization_logo',
  signatures: 'report_signatures',
  orientation: 'report_orientation',
  designer: 'report_designer',
} as const;

export type ReportOrientation = 'auto' | 'portrait' | 'landscape';
const ORIENTATIONS: ReportOrientation[] = ['auto', 'portrait', 'landscape'];
const MAX_NAME = 120;
export const MAX_LOGO_BYTES = 300 * 1024;

export interface OrganizationSettings {
  organization_name: string;
  logo: string | null;
  report_signatures: boolean;
  report_orientation: ReportOrientation;
}

/** Report Designer — how every printed report looks (page size, totals, which columns). */
export interface ReportDesignerSettings {
  /** 0 = automatic (fill the page); otherwise a page break after this many rows (PDF) */
  rows_per_page: number;
  show_totals: boolean;
  row_numbers: boolean;
  /** chosen columns per report, in print order; a missing report uses its defaults */
  columns: Partial<Record<ExportResource, string[]>>;
}

export interface ReportDesignerPatch {
  rows_per_page?: unknown;
  show_totals?: unknown;
  row_numbers?: unknown;
  /** report → column list; an empty list resets that report to its defaults */
  columns?: unknown;
}

/** What the designer screen needs besides the saved values. */
export interface ReportDesignerView extends ReportDesignerSettings {
  catalog: Partial<Record<ExportResource, ReportCatalogEntry>>;
  labels: Record<string, Record<ReportLang, string>>;
  titles: Partial<Record<ExportResource, Record<ReportLang, string>>>;
}

export const DEFAULT_DESIGNER: ReportDesignerSettings = { rows_per_page: 0, show_totals: true, row_numbers: false, columns: {} };
export const MIN_ROWS_PER_PAGE = 5;
export const MAX_ROWS_PER_PAGE = 100;

export interface OrganizationSettingsPatch {
  organization_name?: string;
  report_signatures?: boolean;
  report_orientation?: string;
}

/** Returns the image bytes when `value` is a PNG/JPEG data URI (or raw base64) of an allowed size. */
export function decodeLogo(value: string): { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null {
  const base64 = value.replace(/^data:image\/(png|jpe?g);base64,/i, '').trim();
  if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) return null;
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, mime: 'image/png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, mime: 'image/jpeg' };
  return null;
}

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async get(tenantId: string): Promise<OrganizationSettings> {
    const { rows } = await this.db.queryAsTenant<{ setting_key: string; setting_value: string | null }>(
      tenantId,
      `SELECT setting_key, setting_value FROM settings WHERE tenant_id = $1 AND setting_key = ANY($2::text[])`,
      [tenantId, Object.values(SETTING_KEYS)],
    );
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? '']));
    let name = (map.get(SETTING_KEYS.name) ?? '').trim();
    if (!name) {
      const tenant = await this.db.query<{ name: string }>(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
      name = tenant.rows[0]?.name ?? '';
    }
    const logoRaw = map.get(SETTING_KEYS.logo) ?? '';
    const orientation = map.get(SETTING_KEYS.orientation) as ReportOrientation;
    return {
      organization_name: name,
      logo: logoRaw && decodeLogo(logoRaw) ? this.toDataUri(logoRaw) : null,
      report_signatures: (map.get(SETTING_KEYS.signatures) ?? 'false') === 'true',
      report_orientation: ORIENTATIONS.includes(orientation) ? orientation : 'auto',
    };
  }

  async update(tenantId: string, patch: OrganizationSettingsPatch): Promise<OrganizationSettings> {
    const entries: [string, string][] = [];
    if (patch.organization_name !== undefined) {
      const name = String(patch.organization_name).trim();
      if (name.length < 2 || name.length > MAX_NAME) throw new DomainError('ORGANIZATION_NAME_INVALID');
      entries.push([SETTING_KEYS.name, name]);
    }
    if (patch.report_signatures !== undefined) {
      if (typeof patch.report_signatures !== 'boolean') throw new DomainError('SETTING_VALUE_INVALID');
      entries.push([SETTING_KEYS.signatures, String(patch.report_signatures)]);
    }
    if (patch.report_orientation !== undefined) {
      if (!ORIENTATIONS.includes(patch.report_orientation as ReportOrientation)) throw new DomainError('SETTING_VALUE_INVALID');
      entries.push([SETTING_KEYS.orientation, patch.report_orientation]);
    }
    for (const [key, value] of entries) await this.upsert(tenantId, key, value);
    return this.get(tenantId);
  }

  async setLogo(tenantId: string, dataUri: unknown): Promise<OrganizationSettings> {
    if (typeof dataUri !== 'string') throw new DomainError('LOGO_INVALID');
    const decoded = decodeLogo(dataUri);
    if (!decoded) throw new DomainError('LOGO_INVALID', { max_kb: MAX_LOGO_BYTES / 1024 });
    await this.upsert(tenantId, SETTING_KEYS.logo, `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}`);
    return this.get(tenantId);
  }

  async clearLogo(tenantId: string): Promise<OrganizationSettings> {
    await this.upsert(tenantId, SETTING_KEYS.logo, '');
    return this.get(tenantId);
  }

  /** Saved designer settings, sanitised: a corrupt or outdated value falls back to the defaults. */
  async getDesigner(tenantId: string): Promise<ReportDesignerSettings> {
    const { rows } = await this.db.queryAsTenant<{ setting_value: string | null }>(
      tenantId,
      `SELECT setting_value FROM settings WHERE tenant_id = $1 AND setting_key = $2`,
      [tenantId, SETTING_KEYS.designer],
    );
    let parsed: Record<string, unknown> = {};
    try {
      const value = JSON.parse(rows[0]?.setting_value || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    const rowsPerPage = Number(parsed.rows_per_page);
    const columns: ReportDesignerSettings['columns'] = {};
    const savedColumns = parsed.columns && typeof parsed.columns === 'object' ? parsed.columns as Record<string, unknown> : {};
    for (const [resource, list] of Object.entries(savedColumns)) {
      if (!isDesignableResource(resource) || !Array.isArray(list)) continue;
      const valid = list.filter((key): key is string => typeof key === 'string' && REPORT_CATALOG[resource]!.columns.includes(key));
      if (valid.length > 0) columns[resource] = [...new Set(valid)];
    }
    return {
      rows_per_page: Number.isInteger(rowsPerPage) && rowsPerPage >= MIN_ROWS_PER_PAGE && rowsPerPage <= MAX_ROWS_PER_PAGE ? rowsPerPage : 0,
      show_totals: parsed.show_totals !== false,
      row_numbers: parsed.row_numbers === true,
      columns,
    };
  }

  async getDesignerView(tenantId: string): Promise<ReportDesignerView> {
    const saved = await this.getDesigner(tenantId);
    const keys = new Set(Object.values(REPORT_CATALOG).flatMap((entry) => entry?.columns ?? []));
    const labels: ReportDesignerView['labels'] = {};
    for (const key of keys) if (COLUMN_LABELS[key]) labels[key] = COLUMN_LABELS[key];
    const titles: ReportDesignerView['titles'] = {};
    for (const resource of Object.keys(REPORT_CATALOG) as ExportResource[]) titles[resource] = RESOURCE_TITLES[resource];
    return { ...saved, catalog: REPORT_CATALOG, labels, titles };
  }

  async updateDesigner(tenantId: string, patch: ReportDesignerPatch): Promise<ReportDesignerView> {
    const next = await this.getDesigner(tenantId);
    if (patch.rows_per_page !== undefined) {
      const n = patch.rows_per_page;
      const ok = typeof n === 'number' && Number.isInteger(n) && (n === 0 || (n >= MIN_ROWS_PER_PAGE && n <= MAX_ROWS_PER_PAGE));
      if (!ok) throw new DomainError('SETTING_VALUE_INVALID', { field: 'rows_per_page', min: MIN_ROWS_PER_PAGE, max: MAX_ROWS_PER_PAGE });
      next.rows_per_page = n as number;
    }
    if (patch.show_totals !== undefined) {
      if (typeof patch.show_totals !== 'boolean') throw new DomainError('SETTING_VALUE_INVALID', { field: 'show_totals' });
      next.show_totals = patch.show_totals;
    }
    if (patch.row_numbers !== undefined) {
      if (typeof patch.row_numbers !== 'boolean') throw new DomainError('SETTING_VALUE_INVALID', { field: 'row_numbers' });
      next.row_numbers = patch.row_numbers;
    }
    if (patch.columns !== undefined) {
      if (!patch.columns || typeof patch.columns !== 'object' || Array.isArray(patch.columns)) {
        throw new DomainError('SETTING_VALUE_INVALID', { field: 'columns' });
      }
      for (const [resource, list] of Object.entries(patch.columns as Record<string, unknown>)) {
        if (!isDesignableResource(resource) || !Array.isArray(list)) throw new DomainError('SETTING_VALUE_INVALID', { field: 'columns', resource });
        const allowed = REPORT_CATALOG[resource]!.columns;
        const keys = list.map((key) => String(key));
        if (keys.some((key) => !allowed.includes(key)) || new Set(keys).size !== keys.length) {
          throw new DomainError('SETTING_VALUE_INVALID', { field: 'columns', resource });
        }
        if (keys.length === 0) delete next.columns[resource];
        else next.columns[resource] = keys;
      }
    }
    await this.upsert(tenantId, SETTING_KEYS.designer, JSON.stringify(next));
    return this.getDesignerView(tenantId);
  }

  private toDataUri(stored: string): string {
    const decoded = decodeLogo(stored);
    return decoded ? `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}` : '';
  }

  private async upsert(tenantId: string, key: string, value: string): Promise<void> {
    await this.db.queryAsTenant(
      tenantId,
      `INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [tenantId, key, value],
    );
  }
}

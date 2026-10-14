import { http } from '@/lib/api/client';

export type ReportOrientation = 'auto' | 'portrait' | 'landscape';

export interface OrganizationSettings {
  organization_name: string;
  logo: string | null;
  report_signatures: boolean;
  report_orientation: ReportOrientation;
}

export interface Branding {
  organization_name: string;
  logo: string | null;
}

const ORIENTATIONS: ReportOrientation[] = ['auto', 'portrait', 'landscape'];

export function mapSettings(raw: unknown): OrganizationSettings {
  const value = (raw ?? {}) as Record<string, unknown>;
  const orientation = String(value.report_orientation ?? 'auto') as ReportOrientation;
  return {
    organization_name: String(value.organization_name ?? ''),
    logo: typeof value.logo === 'string' && value.logo ? value.logo : null,
    report_signatures: value.report_signatures === true,
    report_orientation: ORIENTATIONS.includes(orientation) ? orientation : 'auto',
  };
}

export async function getSettings(): Promise<OrganizationSettings> {
  return mapSettings(await http.get<unknown>('/settings'));
}

export async function getBranding(): Promise<Branding> {
  const s = mapSettings(await http.get<unknown>('/settings/branding'));
  return { organization_name: s.organization_name, logo: s.logo };
}

export async function updateSettings(
  patch: Partial<Pick<OrganizationSettings, 'organization_name' | 'report_signatures' | 'report_orientation'>>,
): Promise<OrganizationSettings> {
  return mapSettings(await http.patch<unknown>('/settings', patch));
}

export async function setLogo(dataUri: string): Promise<OrganizationSettings> {
  return mapSettings(await http.put<unknown>('/settings/logo', { data_uri: dataUri }));
}

export async function clearLogo(): Promise<OrganizationSettings> {
  return mapSettings(await http.del<unknown>('/settings/logo'));
}

/** Report Designer — which columns each report prints, rows per page, totals and numbering. */
export interface ReportDesigner {
  rows_per_page: number;
  show_totals: boolean;
  row_numbers: boolean;
  /** columns chosen per report; a missing or empty list means "use the defaults" */
  columns: Record<string, string[]>;
  /** every column a report can offer, and the ones shown by default */
  catalog: Record<string, { columns: string[]; defaults: string[] }>;
  labels: Record<string, { ar: string; en: string }>;
  titles: Record<string, { ar: string; en: string }>;
}

export type ReportDesignerPatch = Partial<Pick<ReportDesigner, 'rows_per_page' | 'show_totals' | 'row_numbers' | 'columns'>>;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map((v) => String(v)) : []);

const pairs = (raw: unknown): Record<string, { ar: string; en: string }> => {
  const out: Record<string, { ar: string; en: string }> = {};
  for (const [key, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const v = (value ?? {}) as Record<string, unknown>;
    out[key] = { ar: String(v.ar ?? key), en: String(v.en ?? key) };
  }
  return out;
};

export function mapReportDesigner(raw: unknown): ReportDesigner {
  const value = (raw ?? {}) as Record<string, unknown>;
  const catalog: ReportDesigner['catalog'] = {};
  for (const [resource, entry] of Object.entries((value.catalog ?? {}) as Record<string, unknown>)) {
    const e = (entry ?? {}) as Record<string, unknown>;
    catalog[resource] = { columns: strings(e.columns), defaults: strings(e.defaults) };
  }
  const columns: Record<string, string[]> = {};
  for (const [resource, list] of Object.entries((value.columns ?? {}) as Record<string, unknown>)) {
    const keys = strings(list);
    if (keys.length > 0) columns[resource] = keys;
  }
  const rows = Number(value.rows_per_page ?? 0);
  return {
    rows_per_page: Number.isInteger(rows) && rows > 0 ? rows : 0,
    show_totals: value.show_totals !== false,
    row_numbers: value.row_numbers === true,
    columns,
    catalog,
    labels: pairs(value.labels),
    titles: pairs(value.titles),
  };
}

export async function getReportDesigner(): Promise<ReportDesigner> {
  return mapReportDesigner(await http.get<unknown>('/settings/report-designer'));
}

export async function updateReportDesigner(patch: ReportDesignerPatch): Promise<ReportDesigner> {
  return mapReportDesigner(await http.put<unknown>('/settings/report-designer', patch));
}

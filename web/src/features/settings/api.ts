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

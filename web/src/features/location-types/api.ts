import { http } from '@/lib/api/client';

export interface LocationTypeOption {
  id: string;
  tenant_id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

function asArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const value = raw as { items?: unknown[]; data?: unknown[] } | null;
  const list = value?.items ?? value?.data ?? [];
  return Array.isArray(list) ? list as Record<string, unknown>[] : [];
}

export function mapLocationType(raw: unknown): LocationTypeOption | null {
  const value = raw as Record<string, unknown>;
  if (!value || value.id == null || value.code == null) return null;
  return {
    id: String(value.id),
    tenant_id: String(value.tenant_id ?? ''),
    code: String(value.code),
    name_ar: String(value.name_ar ?? value.code),
    name_en: value.name_en == null ? null : String(value.name_en),
    icon_key: String(value.icon_key ?? 'map-pin'),
    sort_order: Number(value.sort_order ?? 0),
    is_active: value.is_active !== false,
    is_system: value.is_system === true,
  };
}

export async function listLocationTypes(): Promise<LocationTypeOption[]> {
  const raw = await http.get<unknown>('/location-types');
  return asArray(raw).map(mapLocationType).filter((item): item is LocationTypeOption => item !== null);
}

export async function createLocationType(input: {
  code: string;
  name_ar: string;
  name_en?: string;
  icon_key?: string;
  sort_order?: number;
}): Promise<LocationTypeOption> {
  const raw = await http.post<unknown>('/location-types', input);
  const mapped = mapLocationType(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function updateLocationType(id: string, input: {
  name_ar?: string;
  name_en?: string | null;
  icon_key?: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<LocationTypeOption> {
  const raw = await http.patch<unknown>(`/location-types/${id}`, input);
  const mapped = mapLocationType(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function deactivateLocationType(id: string): Promise<void> {
  await http.del<unknown>(`/location-types/${id}`);
}

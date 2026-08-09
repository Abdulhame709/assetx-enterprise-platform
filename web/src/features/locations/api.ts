/**
 * Locations feature API — hierarchical locations (ADR-005 materialized path).
 * Real backend endpoints: GET/POST/PATCH/DELETE /locations.
 */
import { http } from '@/lib/api/client';

export type LocationType = 'building' | 'room' | 'warehouse' | 'workshop' | 'outdoor';

export interface LocationNode {
  id: string;
  parent_id: string | null;
  name: string;
  location_type: LocationType;
  path: string;
  full_path: string;
  level_number: number;
  is_active: boolean;
}

function asArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const o = raw as { items?: unknown[]; data?: unknown[] } | null;
  const list = o?.items ?? o?.data ?? [];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export function mapLocation(raw: unknown): LocationNode | null {
  const r = raw as Record<string, unknown>;
  if (!r || r.id == null) return null;
  return {
    id: String(r.id),
    parent_id: r.parent_id != null ? String(r.parent_id) : null,
    name: String(r.name ?? ''),
    location_type: (String(r.location_type ?? 'room') as LocationType),
    path: String(r.path ?? ''),
    full_path: String(r.full_path ?? r.name ?? ''),
    level_number: Number(r.level_number ?? 0),
    is_active: r.is_active !== false,
  };
}

export async function getLocations(): Promise<LocationNode[]> {
  const raw = await http.get<unknown>('/locations');
  return asArray(raw).map(mapLocation).filter((l): l is LocationNode => l !== null);
}

export interface CreateLocationInput {
  name: string;
  location_type?: LocationType;
  parent_id?: string | null;
}

export async function createLocation(input: CreateLocationInput): Promise<LocationNode> {
  const raw = await http.post<unknown>('/locations', {
    name: input.name.trim(),
    location_type: input.location_type,
    ...(input.parent_id ? { parent_id: input.parent_id } : {}),
  });
  const mapped = mapLocation(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function updateLocation(
  id: string,
  input: { name?: string; location_type?: LocationType },
): Promise<LocationNode> {
  const raw = await http.patch<unknown>(`/locations/${id}`, input);
  const mapped = mapLocation(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function deleteLocation(id: string): Promise<void> {
  await http.del<unknown>(`/locations/${id}`);
}

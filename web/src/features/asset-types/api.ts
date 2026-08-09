/**
 * Asset Types feature API — hierarchical asset classification (backend: /categories).
 * Note: the backend exposes no DELETE for categories, so this module intentionally
 * has no delete action (parity with the real contract).
 */
import { http } from '@/lib/api/client';

export interface AssetTypeNode {
  id: string;
  parent_id: string | null;
  name: string;
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

export function mapAssetType(raw: unknown): AssetTypeNode | null {
  const r = raw as Record<string, unknown>;
  if (!r || r.id == null) return null;
  return {
    id: String(r.id),
    parent_id: r.parent_id != null ? String(r.parent_id) : null,
    name: String(r.name ?? ''),
    full_path: String(r.full_path ?? r.name ?? ''),
    level_number: Number(r.level_number ?? 0),
    is_active: r.is_active !== false,
  };
}

export async function getAssetTypes(): Promise<AssetTypeNode[]> {
  const raw = await http.get<unknown>('/categories');
  return asArray(raw).map(mapAssetType).filter((c): c is AssetTypeNode => c !== null);
}

export async function createAssetType(input: { name: string; parent_id?: string | null }): Promise<AssetTypeNode> {
  const raw = await http.post<unknown>('/categories', {
    name: input.name.trim(),
    ...(input.parent_id ? { parent_id: input.parent_id } : {}),
  });
  const mapped = mapAssetType(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

export async function updateAssetType(id: string, input: { name?: string }): Promise<AssetTypeNode> {
  const raw = await http.patch<unknown>(`/categories/${id}`, input);
  const mapped = mapAssetType(raw);
  if (!mapped) throw new Error('Unexpected server response');
  return mapped;
}

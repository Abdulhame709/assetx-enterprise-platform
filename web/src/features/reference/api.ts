/**
 * Reference data API layer — shared lookup/master-data fetchers used by
 * asset forms, filters and master-data screens (real backend only).
 * Raw responses are normalized here; pages never see backend variance.
 */
import { http } from '@/lib/api/client';

export interface ReferenceStatus { id: string; name: string; color: string | null; is_active: boolean; }
export interface ReferenceEmployee { id: string; name: string; department: string | null; phone: string | null; email: string | null; }
export interface ReferenceModel { id: string; name: string; category_id: string | null; }

function asArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const o = raw as { items?: unknown[]; data?: unknown[] } | null;
  const list = o?.items ?? o?.data ?? [];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export async function getStatuses(): Promise<ReferenceStatus[]> {
  const raw = await http.get<unknown>('/statuses');
  return asArray(raw)
    .map((s) => ({ id: String(s.id ?? ''), name: String(s.name ?? ''), color: s.color != null ? String(s.color) : null, is_active: s.is_active !== false }))
    .filter((s) => s.id !== '');
}

export async function createStatus(input: { name: string; color?: string }): Promise<ReferenceStatus> {
  const raw = await http.post<unknown>('/statuses', input);
  const s = (raw ?? {}) as Record<string, unknown>;
  return { id: String(s.id ?? ''), name: String(s.name ?? ''), color: s.color != null ? String(s.color) : null, is_active: s.is_active !== false };
}

export async function updateStatus(id: string, input: { name?: string; color?: string }): Promise<ReferenceStatus> {
  const raw = await http.patch<unknown>(`/statuses/${id}`, input);
  const s = (raw ?? {}) as Record<string, unknown>;
  return { id: String(s.id ?? ''), name: String(s.name ?? ''), color: s.color != null ? String(s.color) : null, is_active: s.is_active !== false };
}

export async function getEmployees(): Promise<ReferenceEmployee[]> {
  const raw = await http.get<unknown>('/employees');
  return asArray(raw)
    .map((e) => ({
      id: String(e.id ?? ''),
      name: String(e.name ?? ''),
      department: e.department != null ? String(e.department) : null,
      phone: e.phone != null ? String(e.phone) : null,
      email: e.email != null ? String(e.email) : null,
    }))
    .filter((e) => e.id !== '');
}

function mapEmployee(raw: unknown): ReferenceEmployee {
  const e = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(e.id ?? ''), name: String(e.name ?? ''),
    department: e.department != null ? String(e.department) : null,
    phone: e.phone != null ? String(e.phone) : null,
    email: e.email != null ? String(e.email) : null,
  };
}

export async function createEmployee(input: { name: string; department?: string; phone?: string; email?: string }): Promise<ReferenceEmployee> {
  return mapEmployee(await http.post<unknown>('/employees', input));
}

export async function updateEmployee(id: string, input: { name?: string; department?: string; phone?: string; email?: string }): Promise<ReferenceEmployee> {
  return mapEmployee(await http.patch<unknown>(`/employees/${id}`, input));
}

export async function deleteEmployee(id: string): Promise<void> {
  await http.del(`/employees/${id}`);
}

export async function getModels(): Promise<ReferenceModel[]> {
  const raw = await http.get<unknown>('/models');
  return asArray(raw)
    .map((m) => ({
      id: String(m.id ?? ''),
      name: String(m.name ?? ''),
      category_id: m.category_id != null ? String(m.category_id) : null,
    }))
    .filter((m) => m.id !== '');
}

import { http } from '@/lib/api/client';

export interface AdminRole {
  id: string;
  name: string;
  role_type: string | null;
  description: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  employee_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  roles: Array<{ id: string; name: string }>;
}

function asArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const value = raw as { items?: unknown[]; data?: unknown[] } | null;
  const list = value?.items ?? value?.data ?? [];
  return Array.isArray(list) ? list as Record<string, unknown>[] : [];
}

function mapRole(raw: Record<string, unknown>): AdminRole {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    role_type: raw.role_type == null ? null : String(raw.role_type),
    description: raw.description == null ? null : String(raw.description),
  };
}

function mapUser(raw: Record<string, unknown>): AdminUser {
  const rawRoles = Array.isArray(raw.roles) ? raw.roles : [];
  return {
    id: String(raw.id ?? ''),
    username: String(raw.username ?? ''),
    email: raw.email == null ? null : String(raw.email),
    employee_id: raw.employee_id == null ? null : String(raw.employee_id),
    is_active: raw.is_active !== false,
    last_login: raw.last_login == null ? null : String(raw.last_login),
    created_at: String(raw.created_at ?? ''),
    roles: rawRoles
      .map((role) => {
        const value = (role ?? {}) as Record<string, unknown>;
        return { id: String(value.id ?? ''), name: String(value.name ?? '') };
      })
      .filter((role) => role.id !== ''),
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const raw = await http.get<unknown>('/users/admin/users');
  return asArray(raw).map(mapUser).filter((user) => user.id !== '');
}

export async function listAdminRoles(): Promise<AdminRole[]> {
  const raw = await http.get<unknown>('/users/admin/roles');
  return asArray(raw).map(mapRole).filter((role) => role.id !== '');
}

export async function updateAdminUserStatus(id: string, isActive: boolean): Promise<Pick<AdminUser, 'id' | 'username' | 'is_active'>> {
  const raw = await http.patch<unknown>(`/users/admin/users/${id}/status`, { is_active: isActive });
  const value = (raw ?? {}) as Record<string, unknown>;
  return { id: String(value.id ?? id), username: String(value.username ?? ''), is_active: value.is_active !== false };
}

export async function replaceAdminUserRoles(id: string, roleIds: string[]): Promise<AdminUser[]> {
  const raw = await http.patch<unknown>(`/users/admin/users/${id}/roles`, { role_ids: roleIds });
  return asArray(raw).map(mapUser).filter((user) => user.id !== '');
}

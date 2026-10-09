/**
 * UsersService — application use cases for the current user.
 * Reference: FRS FR-AUT-* / FR-ADM-003 · API Spec (DOC-10) User endpoints
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DATABASE_PORT } from '../core/ports/tokens';
import { UserRepository } from '../infrastructure/repositories/user.repository';
import { DatabasePort } from '../core/ports/database.port';
import { bumpPermissionVersion } from '../bootstrap/permission-version';
import { AuthService } from './auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthService,
    @Optional() @Inject(DATABASE_PORT) private readonly db?: DatabasePort,
  ) {}

  /** GET /users/me — returns the authenticated user's own profile (tenant-scoped). */
  async me(userId: string): Promise<{
    id: string;
    username: string;
    email: string | null;
    tenant_id: string;
    last_login: Date | null;
    roles: string[];
  } | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    const roles = await this.users.findRoleNames(user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      tenant_id: user.tenant_id,
      last_login: user.last_login,
      roles,
    };
  }

  /** GET /users/admin/users — list tenant users for the administration workspace. */
  async listTenantUsers(tenantId: string) {
    return this.users.listTenantUsers(tenantId);
  }

  /** GET /users/admin/roles — list active tenant roles for role assignment. */
  async listTenantRoles(tenantId: string) {
    return this.users.listTenantRoles(tenantId);
  }

  /**
   * POST /users/admin/users — an administrator creates a user inside their own
   * tenant. The tenant is never taken from the request body.
   */
  async createTenantUser(
    tenantId: string,
    input: { username: string; email?: string; password: string; roleIds?: string[] },
  ) {
    const roleIds = [...new Set(input.roleIds ?? [])];
    if (roleIds.length) {
      const known = new Set((await this.users.listTenantRoles(tenantId)).map((role) => role.id));
      if (roleIds.some((id) => !known.has(id))) throw new Error('ROLE_NOT_FOUND');
    }
    const created = await this.auth.register({
      tenantId,
      username: input.username,
      email: input.email,
      password: input.password,
    });
    if (roleIds.length) {
      await this.users.replaceTenantUserRoles(created.user.id, tenantId, roleIds);
      if (this.db) await bumpPermissionVersion(this.db, tenantId);
    }
    return { id: created.user.id, username: created.user.username, role_ids: roleIds };
  }

  /** PATCH /users/admin/users/:id/status — activate/deactivate a tenant user. */
  async updateTenantUserStatus(userId: string, tenantId: string, isActive: boolean) {
    const updated = await this.users.updateTenantUserStatus(userId, tenantId, isActive);
    if (!updated) return null;
    return updated;
  }

  /** PATCH /users/admin/users/:id/roles — replace a tenant user's role set. */
  async replaceTenantUserRoles(userId: string, tenantId: string, roleIds: string[]) {
    const target = await this.users.findByIdInTenant(userId, tenantId);
    if (!target) return null;
    await this.users.replaceTenantUserRoles(userId, tenantId, roleIds);
    if (this.db) await bumpPermissionVersion(this.db, tenantId);
    return this.users.listTenantUsers(tenantId);
  }

  /** PATCH /users/profile — update current user profile (only permitted fields). */
  async updateProfile(userId: string, patch: { email?: string }): Promise<{ id: string; email: string | null } | null> {
    const user = await this.users.updateProfile(userId, { email: patch.email ?? null });
    if (!user) return null;
    return { id: user.id, email: user.email };
  }
}

/**
 * UserRepository — data access for users/roles/permissions.
 * Reference: Data Dictionary (DOC-24) TB-USER/TB-ROLE/TB-PERMISSION/TB-USER-ROLE
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Permission, Role, User } from '../../core/entities/user.entity';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(user: Partial<User>): Promise<User> {
    const { rows } = await this.db.query<User>(
      `INSERT INTO users (tenant_id, employee_id, username, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.tenant_id, user.employee_id ?? null, user.username, user.email ?? null, user.password_hash, true],
    );
    return rows[0];
  }

  /**
   * Pre-session lookup: the database function exposes only auth fields and
   * bypasses tenant RLS in a tightly scoped SECURITY DEFINER context.
   */
  async findByUsername(username: string): Promise<User | null> {
    const { rows } = await this.db.query<User>(
      `SELECT * FROM authenticate_user($1)`,
      [username],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.db.query<User>(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateProfile(id: string, patch: { email?: string | null }): Promise<User | null> {
    const { rows } = await this.db.query<User>(
      `UPDATE users SET email = COALESCE($2, email), updated_at = now() WHERE id = $1 RETURNING *`,
      [id, patch.email ?? null],
    );
    return rows[0] ?? null;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.query(`UPDATE users SET last_login = now() WHERE id = $1`, [id]);
  }

  async findRoles(userId: string): Promise<Role[]> {
    const { rows } = await this.db.query<Role>(
      `SELECT r.* FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND r.is_active = true`,
      [userId],
    );
    return rows;
  }

  async findRoleNames(userId: string): Promise<string[]> {
    const roles = await this.findRoles(userId);
    return roles.map((r) => r.name);
  }

  async findPermissions(userId: string): Promise<Permission[]> {
    const { rows } = await this.db.query<Permission>(
      `SELECT p.id, p.tenant_id, p.module_name, p.can_view, p.can_add, p.can_edit, p.can_delete, p.can_print
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1 AND p.is_active = true
       UNION
       SELECT p2.id, p2.tenant_id, p2.module_name, p2.can_view, p2.can_add, p2.can_edit, p2.can_delete, p2.can_print
       FROM permissions p2
       JOIN user_permissions up ON up.module_name = p2.module_name
       WHERE up.user_id = $1`,
      [userId],
    );
    return rows;
  }

  async hasPermission(userId: string, module: string, action: 'view'|'add'|'edit'|'delete'|'print'): Promise<boolean> {
    const perms = await this.findPermissions(userId);
    return perms.some((p) => p.module_name === module && Boolean((p as unknown as Record<string, boolean>)[`can_${action}`]));
  }

  /**
   * Resolve a user's flat permission keys (e.g. 'asset.create').
   * module_name holds the permission key; can_view=true marks it active (Phase 9).
   * Combines role_permissions + direct user_permissions.
   */
  async findPermissionKeys(userId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ key: string }>(
      `SELECT DISTINCT p.module_name AS key
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1 AND p.is_active = true AND p.can_view = true
       UNION
       SELECT module_name AS key FROM user_permissions
       WHERE user_id = $1 AND can_view = true`,
      [userId],
    );
    return rows.map((r) => r.key);
  }

  async findTenantCode(tenantId: string): Promise<string | null> {
    const { rows } = await this.db.query<{ tenant_code: string }>(
      `SELECT tenant_code FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.tenant_code ?? null;
  }

  async findTenant(tenantId: string): Promise<{ id: string; tenant_code: string; name: string; status: string } | null> {
    const { rows } = await this.db.query<{ id: string; tenant_code: string; name: string; status: string }>(
      `SELECT id, tenant_code, name, status FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return rows[0] ?? null;
  }
}

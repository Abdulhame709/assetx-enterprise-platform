/**
 * UsersService — application use cases for the current user.
 * Reference: FRS FR-AUT-* / FR-ADM-003 · API Spec (DOC-10) User endpoints
 */
import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/repositories/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

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

  /** PATCH /users/profile — update current user profile (only permitted fields). */
  async updateProfile(userId: string, patch: { email?: string }): Promise<{ id: string; email: string | null } | null> {
    const user = await this.users.updateProfile(userId, { email: patch.email ?? null });
    if (!user) return null;
    return { id: user.id, email: user.email };
  }
}

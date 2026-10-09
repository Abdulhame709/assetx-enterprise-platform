/**
 * AuthService — authentication use cases.
 * Registration, login, logout, refresh rotation, reset-password, session handling.
 * Reference: Security Architecture (DOC-13) · FRS FR-AUT-* · BR-SEC-005
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { PasswordHasher, TokenManager, TokenPayload } from '../core/ports/auth.port';
import { UserRepository } from '../infrastructure/repositories/user.repository';
import { DATABASE_PORT, PASSWORD_HASHER, TOKEN_MANAGER } from '../core/ports/tokens';
import { getPermissionVersion } from '../bootstrap/permission-version';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { createHash, randomBytes, randomUUID } from 'crypto';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface RegisterInput {
  tenantId: string;
  username: string;
  email?: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_MANAGER) private readonly tokens: TokenManager,
    private readonly audit: AuditService,
  ) {}

  /** Validate minimal password policy (implementation-level; full rules in Validation Rules spec). */
  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error('PASSWORD_TOO_WEAK');
    }
  }

  async register(input: RegisterInput): Promise<{ user: { id: string; username: string }; message: string }> {
    this.validatePassword(input.password);
    if (!input.tenantId) throw new Error('TENANT_REQUIRED');
    await this.db.setTenant(input.tenantId);
    const existing = await this.users.findByUsername(input.username);
    if (existing) throw new Error('USERNAME_EXISTS');

    const hash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      tenant_id: input.tenantId,
      username: input.username,
      email: input.email,
      password_hash: hash,
    });
    return {
      user: { id: user.id, username: user.username },
      message: 'registered_pending_email_verification',
    };
  }

  async login(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; username: string; tenant_id: string };
  }> {
    const user = await this.users.findByUsername(input.username);
    if (!user || !user.is_active) throw new Error('INVALID_CREDENTIALS');
    const valid = await this.hasher.verify(input.password, user.password_hash);
    if (!valid) {
      await this.audit.log({
        tenant_id: user.tenant_id,
        userId: user.id,
        action: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
        entity: 'auth',
        entityId: user.id,
        metadata: { username: input.username, reason: 'invalid_password' },
      }).catch(() => undefined);
      throw new Error('INVALID_CREDENTIALS');
    }

    await this.db.setTenant(user.tenant_id);
    const roleNames = await this.users.findRoleNames(user.id);
    const role = roleNames[0] ?? 'Employee';
    const permissions = await this.users.findPermissionKeys(user.id);
    const permissionVersion = await getPermissionVersion(this.db, user.tenant_id);
    const sessionId = randomUUID();

    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      tenant_id: user.tenant_id,
      role,
      roles: roleNames.length ? roleNames : ['Employee'],
      permissions,
      permission_version: permissionVersion,
      session_id: sessionId,
    };
    const accessToken = this.tokens.signAccessToken(payload);
    const refreshToken = this.tokens.signRefreshToken(payload);
    await this.db.query(
      `INSERT INTO auth_sessions (id, user_id, tenant_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        sessionId,
        user.id,
        user.tenant_id,
        hashOpaqueToken(refreshToken),
        new Date(Date.now() + REFRESH_SESSION_TTL_MS).toISOString(),
      ],
    );

    await this.users.updateLastLogin(user.id);
    await this.audit.log({
      tenant_id: user.tenant_id,
      userId: user.id,
      action: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS,
      entity: 'auth',
      entityId: user.id,
      metadata: { username: user.username },
    }).catch(() => undefined);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, tenant_id: user.tenant_id },
    };
  }

  /**
   * Local maintenance-only verification used after a password reset. This
   * deliberately does not create a session, return tokens, or expose hashes.
   */
  async verifyPasswordForLocalReset(username: string, password: string): Promise<boolean> {
    const user = await this.users.findByUsername(username);
    if (!user || !user.is_active) return false;
    return this.hasher.verify(password, user.password_hash);
  }

  /** Logout: revoke the access token's server-side session. */
  async logout(token: string): Promise<void> {
    const payload = this.tokens.decode(token);
    if (!payload?.session_id) return;
    await this.db.query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE id = $1 AND revoked_at IS NULL`,
      [payload.session_id],
    );
  }

  /**
   * Refresh with one-time rotation. The old refresh token is atomically revoked
   * and linked to the replacement, so replaying it fails across all instances.
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    await this.db.setTenant(payload.tenant_id);
    const user = await this.users.findById(payload.sub);
    if (!user || !user.is_active) throw new Error('SESSION_REVOKED');

    const roleNames = await this.users.findRoleNames(user.id);
    const permissions = await this.users.findPermissionKeys(user.id);
    const currentVersion = await getPermissionVersion(this.db, user.tenant_id);
    const newSessionId = randomUUID();
    const clean: TokenPayload = {
      sub: user.id,
      username: user.username,
      tenant_id: user.tenant_id,
      role: roleNames[0] ?? 'Employee',
      roles: roleNames.length ? roleNames : ['Employee'],
      permissions,
      permission_version: currentVersion,
      session_id: newSessionId,
    };
    const newAccessToken = this.tokens.signAccessToken(clean);
    const newRefreshToken = this.tokens.signRefreshToken(clean);
    const { rows } = await this.db.query<{ id: string }>(
      `WITH consumed AS (
         UPDATE auth_sessions
         SET revoked_at = now(), replaced_by = $6
         WHERE id = $1 AND user_id = $2 AND tenant_id = $3
           AND token_hash = $4 AND revoked_at IS NULL AND expires_at > now()
         RETURNING id
       ), inserted AS (
         INSERT INTO auth_sessions (id, user_id, tenant_id, token_hash, expires_at)
         SELECT $6, $2, $3, $5, $7 FROM consumed
         RETURNING id
       )
       SELECT id FROM inserted`,
      [
        payload.session_id,
        user.id,
        user.tenant_id,
        hashOpaqueToken(refreshToken),
        hashOpaqueToken(newRefreshToken),
        newSessionId,
        new Date(Date.now() + REFRESH_SESSION_TTL_MS).toISOString(),
      ],
    );
    if (!rows[0]) throw new Error('SESSION_REVOKED');

    await this.audit.log({
      tenant_id: user.tenant_id,
      userId: user.id,
      action: AUDIT_EVENTS.AUTH_TOKEN_REFRESH,
      entity: 'auth',
      entityId: user.id,
    }).catch(() => undefined);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Request a password reset. The raw token is returned only for the local/test
   * adapter; production delivery must send it through a trusted email provider.
   */
  async requestPasswordReset(username: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.users.findByUsername(username);
    if (!user) return { message: 'if_user_exists_reset_sent' };

    const resetToken = randomBytes(32).toString('base64url');
    const tokenHash = hashOpaqueToken(resetToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    await this.db.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );
    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, tenant_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, user.tenant_id, tokenHash, expiresAt],
    );

    return { message: 'if_user_exists_reset_sent', resetToken };
  }

  /** Complete a reset with a valid, unexpired, one-time token. */
  async completePasswordReset(resetToken: string, newPassword: string): Promise<void> {
    this.validatePassword(newPassword);
    if (!resetToken || resetToken.length < 40) {
      throw new Error('PASSWORD_RESET_TOKEN_INVALID');
    }

    const { rows } = await this.db.query<{
      id: string;
      user_id: string;
      tenant_id: string;
    }>(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING id, user_id, tenant_id`,
      [hashOpaqueToken(resetToken)],
    );
    const token = rows[0];
    if (!token) throw new Error('PASSWORD_RESET_TOKEN_INVALID');

    await this.db.setTenant(token.tenant_id);
    const user = await this.users.findById(token.user_id);
    if (!user || !user.is_active) throw new Error('PASSWORD_RESET_TOKEN_INVALID');

    const passwordHash = await this.hasher.hash(newPassword);
    await this.db.query(
      `UPDATE users SET password_hash = $2, updated_at = now()
       WHERE id = $1 AND tenant_id = $3`,
      [user.id, passwordHash, token.tenant_id],
    );
    await this.db.query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id],
    );

    await this.audit.log({
      tenant_id: token.tenant_id,
      userId: user.id,
      action: AUDIT_EVENTS.AUTH_PASSWORD_RESET,
      entity: 'auth',
      entityId: user.id,
    }).catch(() => undefined);
  }
}

/**
 * AuthService — application use cases for authentication.
 * Registration, login, logout, refresh, reset-password, session handling.
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

function hashResetToken(token: string): string {
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
  private sessions = new Map<string, string>(); // sessionId -> userId (in-memory session store)

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
    // Scope registration to the target tenant so RLS (current_tenant_id) allows the insert.
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

  async login(input: LoginInput): Promise<{ accessToken: string; refreshToken: string; user: { id: string; username: string; tenant_id: string } }> {
    const user = await this.users.findByUsername(input.username);
    if (!user || !user.is_active) throw new Error('INVALID_CREDENTIALS');
    const valid = await this.hasher.verify(input.password, user.password_hash);
    if (!valid) {
      if (user.tenant_id) await this.audit.log({
        tenant_id: user.tenant_id, userId: user.id,
        action: AUDIT_EVENTS.AUTH_LOGIN_FAILED, entity: 'auth', entityId: user.id,
        metadata: { username: input.username, reason: 'invalid_password' },
      }).catch(() => undefined);
      throw new Error('INVALID_CREDENTIALS');
    }

    const roleNames = await this.users.findRoleNames(user.id);
    const role = roleNames[0] ?? 'Employee';
    const permissions = await this.users.findPermissionKeys(user.id);
    const permissionVersion = await getPermissionVersion(this.db, user.tenant_id);
    const sessionId = randomUUID();
    this.sessions.set(sessionId, user.id);

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
    await this.users.updateLastLogin(user.id);
    await this.audit.log({
      tenant_id: user.tenant_id, userId: user.id,
      action: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS, entity: 'auth', entityId: user.id,
      metadata: { username: user.username },
    }).catch(() => undefined);
    return {
      accessToken: this.tokens.signAccessToken(payload),
      refreshToken: this.tokens.signRefreshToken(payload),
      user: { id: user.id, username: user.username, tenant_id: user.tenant_id },
    };
  }

  /** Logout: revoke the session (server-side session invalidation). */
  async logout(token: string): Promise<void> {
    const payload = this.tokens.decode(token);
    if (payload?.session_id) this.sessions.delete(payload.session_id);
  }

  /** Refresh: validate refresh token, issue a new access token. */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    const sessionExists = this.sessions.has(payload.session_id);
    if (!sessionExists) throw new Error('SESSION_REVOKED');
    // Rebuild a clean payload (verify() returns iat/exp which must not be re-signed).
    const currentVersion = await getPermissionVersion(this.db, payload.tenant_id);
    const clean: TokenPayload = {
      sub: payload.sub,
      username: payload.username,
      tenant_id: payload.tenant_id,
      role: payload.role,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      permission_version: currentVersion,
      session_id: payload.session_id,
    };
    await this.audit.log({
      tenant_id: payload.tenant_id, userId: payload.sub,
      action: AUDIT_EVENTS.AUTH_TOKEN_REFRESH, entity: 'auth', entityId: payload.sub,
    }).catch(() => undefined);
    return { accessToken: this.tokens.signAccessToken(clean) };
  }

  /**
   * Request a password reset. The raw token is returned only for the local/test
   * adapter; production delivery must send it through a trusted email provider.
   * Only the SHA-256 digest is persisted, so a database read cannot redeem it.
   */
  async requestPasswordReset(username: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      // Do not reveal whether the user exists (security best practice).
      return { message: 'if_user_exists_reset_sent' };
    }

    const resetToken = randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(resetToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

    // Invalidate previously issued tokens for this user before issuing a new one.
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

    const tokenHash = hashResetToken(resetToken);
    const { rows } = await this.db.query<{
      id: string;
      user_id: string;
      tenant_id: string;
    }>(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING id, user_id, tenant_id`,
      [tokenHash],
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

    // A password reset invalidates every existing in-memory session for this user.
    for (const [sessionId, sessionUserId] of this.sessions.entries()) {
      if (sessionUserId === user.id) this.sessions.delete(sessionId);
    }

    await this.audit.log({
      tenant_id: token.tenant_id,
      userId: user.id,
      action: AUDIT_EVENTS.AUTH_PASSWORD_RESET,
      entity: 'auth',
      entityId: user.id,
    }).catch(() => undefined);
  }

  getSessionUser(sessionId: string): string | null {
    return this.sessions.get(sessionId) ?? null;
  }
}

/**
 * AuthGuard — validates the JWT access token, attaches the user to the request,
 * and enforces permission versioning (Phase 9.5 — Task 5): if the JWT's
 * permission_version differs from the current DB version, the token is stale and
 * a refresh is forced (PERMISSIONS_STALE).
 * Reference: Security Architecture (DOC-13) · API Spec auth endpoints
 */
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { TokenManager, TokenPayload } from '../../core/ports/auth.port';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT, TOKEN_MANAGER } from '../../core/ports/tokens';
import { getPermissionVersion } from '../../bootstrap/permission-version';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_MANAGER) private readonly tokens: TokenManager,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new Error('UNAUTHORIZED');
    try {
      const payload: TokenPayload = this.tokens.verifyAccessToken(token);
      // Set the tenant context so RLS-scoped reads (permission_version) work before TenantGuard.
      await this.db.setTenant(payload.tenant_id);
      // Permission version check — force refresh if stale (Task 5)
      const currentVersion = await getPermissionVersion(this.db, payload.tenant_id);
      if (payload.permission_version !== currentVersion) {
        throw new Error('PERMISSIONS_STALE');
      }
      req.user = {
        sub: payload.sub,
        username: payload.username,
        tenant_id: payload.tenant_id,
        role: payload.role,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
        session_id: payload.session_id,
      };
      return true;
    } catch (e) {
      if ((e as Error).message === 'PERMISSIONS_STALE') throw e;
      throw new Error('UNAUTHORIZED');
    }
  }
}

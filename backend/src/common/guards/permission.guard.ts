/**
 * PermissionGuard — enforces flat permission keys declared via @RequirePermission(...).
 * Supports ANY/ALL modes and multiple permissions. Logs authorization decisions to
 * the existing audit_events table (append-only) — no new table.
 * Reference: Security Architecture (DOC-13) · Phase 9.5 authorization hardening
 */
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';
import { PERMISSIONS_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  private satisfies(requirement: PermissionRequirement, granted: string[]): boolean {
    if (requirement.mode === 'ALL') {
      return requirement.permissions.every((p) => granted.includes(p));
    }
    // ANY (default)
    return requirement.permissions.some((p) => granted.includes(p));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirements = this.reflector.getAllAndOverride<PermissionRequirement[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub?: string; tenant_id?: string; permissions?: string[] } | undefined;
    if (!user) throw new Error('UNAUTHORIZED');
    const granted = user.permissions ?? [];

    // No permission requirements → allow (route is auth-only via AuthGuard/TenantGuard)
    if (!requirements || requirements.length === 0) {
      return true;
    }

    const method = context.getHandler().name;
    const resource = context.getClass().name;
    const allPass = requirements.every((r) => this.satisfies(r, granted));
    const requiredKeys = requirements.flatMap((r) => r.permissions);

    await this.audit({
      tenantId: user.tenant_id ?? '',
      userId: user.sub ?? null,
      permission: requiredKeys.join(','),
      resource,
      action: method,
      result: allPass ? 'ALLOWED' : 'DENIED',
      reason: allPass ? 'Permission granted' : 'Permission missing',
    });

    if (!allPass) throw new Error('FORBIDDEN');
    return true;
  }

  /** Append-only authorization decision log (uses existing audit_events table). */
  private async audit(opts: {
    tenantId: string;
    userId: string | null;
    permission: string;
    resource: string;
    action: string;
    result: 'ALLOWED' | 'DENIED';
    reason: string;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_events (tenant_id, user_id, action_type, table_name, record_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
        [
          opts.tenantId,
          opts.userId,
          'authz',
          'permission',
          opts.resource,
          JSON.stringify({
            permission: opts.permission,
            resource: opts.resource,
            action: opts.action,
            result: opts.result,
            reason: opts.reason,
            timestamp: new Date().toISOString(),
          }),
        ],
      );
    } catch {
      // Audit must never break the authorization decision.
    }
  }
}

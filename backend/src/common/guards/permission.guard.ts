/**
 * PermissionGuard — enforces flat permission keys declared via @RequirePermission(...).
 * Supports ANY/ALL modes and multiple permissions. Logs authorization decisions
 * through AuditService (which delegates to AuditRepository → audit_events).
 * No direct DB access here (Phase 10.3).
 * Reference: Security Architecture (DOC-13) · ADR-010
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../application/audit.service';
import { AUDIT_EVENTS } from '../../core/constants/audit-events';
import { PERMISSIONS_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
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
    const requiredKeys = requirements.flatMap((r) => r.permissions);
    const allPass = requirements.every((r) => this.satisfies(r, granted));

    if (allPass) {
      await this.audit.log({
        tenant_id: user.tenant_id ?? '',
        userId: user.sub ?? null,
        action: AUDIT_EVENTS.PERMISSION_GRANTED,
        entity: 'permission',
        entityId: resource,
        metadata: {
          permission: requiredKeys.join(','),
          endpoint: req.route?.path ?? req.url,
          method: req.method,
          resource,
          reason: 'Permission granted',
        },
      });
    } else {
      await this.audit.log({
        tenant_id: user.tenant_id ?? '',
        userId: user.sub ?? null,
        action: AUDIT_EVENTS.PERMISSION_DENIED,
        entity: 'permission',
        entityId: resource,
        metadata: {
          required_permission: requiredKeys.join(','),
          provided_permissions: granted,
          endpoint: req.route?.path ?? req.url,
          reason: 'Permission missing',
        },
      });
    }

    if (!allPass) throw new Error('FORBIDDEN');
    return true;
  }
}

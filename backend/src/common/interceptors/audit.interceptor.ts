/**
 * AuditInterceptor — global HTTP-level request audit.
 * Records API request metadata only (endpoint, method, status, duration, user,
 * tenant, IP, user-agent). It does NOT record business events (those belong to
 * Domain Services) — avoiding duplicate logging (Phase 10.4).
 * Reference: ADR-010
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditService } from '../../application/audit.service';
import { AUDIT_EVENTS } from '../../core/constants/audit-events';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { sub?: string; tenant_id?: string } }>();
    const started = Date.now();
    const user = req.user;

    return next.handle().pipe(
      tap({
        next: () => {
          const status = context.switchToHttp().getResponse().statusCode ?? 200;
          void this.log(req, user, status, Date.now() - started, 'SUCCESS');
        },
        error: (err: { status?: number }) => {
          const status = err?.status ?? 500;
          void this.log(req, user, status, Date.now() - started, 'ERROR');
        },
      }),
    );
  }

  private async log(
    req: Request,
    user: { sub?: string; tenant_id?: string } | undefined,
    status: number,
    durationMs: number,
    result: string,
  ): Promise<void> {
    try {
      if (!user?.tenant_id) return; // no tenant context (e.g. pre-auth) → skip to avoid noise
      await this.audit.log({
        tenant_id: user.tenant_id,
        userId: user.sub ?? null,
        action: AUDIT_EVENTS.API_REQUEST,
        entity: 'api',
        entityId: req.route?.path ?? req.path,
        metadata: {
          endpoint: req.route?.path ?? req.path,
          method: req.method,
          status_code: status,
          duration_ms: durationMs,
          result,
        },
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
    } catch {
      // Audit must never break the request.
    }
  }
}

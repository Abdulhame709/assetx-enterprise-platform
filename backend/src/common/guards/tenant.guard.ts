/**
 * TenantGuard — binds the authenticated user's tenant to the database session,
 * driving Row-Level Security (ADR-004) for every query in the request.
 * Reference: Security Architecture (DOC-13) §4.3 · RLS Policy · ADR-004
 */
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { tenant_id: string };
    if (!user || !user.tenant_id) throw new Error('UNAUTHORIZED');
    // Set RLS context so current_tenant_id() resolves to this user's tenant.
    await this.db.setTenant(user.tenant_id);
    return true;
  }
}

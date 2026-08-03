/**
 * RBACGuard — enforces role/permission requirements on a route.
 * Reference: Security Architecture (DOC-13) · FRS FR-ADM-001/002 · BR-SEC-005
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenPayload } from '../../core/ports/auth.port';

export interface RbacOptions {
  /** Allowed roles (any match passes). */
  roles?: string[];
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly options: RbacOptions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as TokenPayload;
    if (!user) throw new Error('UNAUTHORIZED');
    if (!this.options.roles || this.options.roles.length === 0) return true;
    // role is carried in the JWT (denormalized for authorization)
    const allowed = this.options.roles.includes(user.role);
    if (!allowed) throw new Error('FORBIDDEN');
    return true;
  }
}

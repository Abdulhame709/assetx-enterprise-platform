/**
 * RolesGuard — enforces roles declared via @Roles(...) metadata (RBAC).
 * Reference: Security Architecture (DOC-13) · FRS FR-ADM-001 · BR-SEC-005
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user as { role: string };
    if (!user) throw new Error('UNAUTHORIZED');
    if (!roles.includes(user.role)) throw new Error('FORBIDDEN');
    return true;
  }
}

/**
 * PermissionGuard — enforces flat permission keys declared via @RequirePermission(...).
 * Reads the user's permissions from the JWT payload (Phase 9).
 * Reference: Security Architecture (DOC-13) · Phase 9 permission matrix
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user as { permissions?: string[] };
    if (!user) throw new Error('UNAUTHORIZED');
    const granted = user.permissions ?? [];
    const ok = required.some((p) => granted.includes(p));
    if (!ok) throw new Error('FORBIDDEN');
    return true;
  }
}

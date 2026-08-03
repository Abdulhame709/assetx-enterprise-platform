/**
 * Roles decorator — declares required roles for a route.
 * Used with RolesGuard to enforce RBAC.
 */
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

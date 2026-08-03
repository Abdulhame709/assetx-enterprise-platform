/**
 * RequirePermission decorator — declares required permissions with ANY/ALL modes.
 * Usage:
 *   @RequirePermission('asset.create')                       → ANY of ['asset.create']
 *   @RequirePermission('asset.update', 'asset.transfer')     → OR of the two (ANY each)
 *   @RequirePermission(['asset.update', 'asset.transfer'])   → ANY of the array
 *   @RequirePermission({ permissions: ['movement.approve','asset.update'], mode: 'ALL' })
 *                                                             → ALL required
 * Used with PermissionGuard to enforce the permission matrix (Phase 9.5).
 */
import { SetMetadata } from '@nestjs/common';

export type PermissionMode = 'ANY' | 'ALL';

export interface PermissionRequirement {
  permissions: string[];
  mode: PermissionMode;
}

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermission = (
  ...args: (string | string[] | PermissionRequirement)[]
): MethodDecorator => {
  const requirements: PermissionRequirement[] = args.map((a) => {
    if (typeof a === 'string') return { permissions: [a], mode: 'ANY' };
    if (Array.isArray(a)) return { permissions: a, mode: 'ANY' };
    return { permissions: a.permissions, mode: a.mode ?? 'ANY' };
  });
  return SetMetadata(PERMISSIONS_KEY, requirements);
};

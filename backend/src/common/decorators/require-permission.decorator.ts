/**
 * RequirePermission decorator — declares required permission keys (e.g. 'asset.create').
 * Used with PermissionGuard to enforce the permission matrix (Phase 9).
 */
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

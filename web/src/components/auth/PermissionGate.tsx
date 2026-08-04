'use client';

import { ReactNode } from 'react';
import { useCan } from '@/lib/auth/session-context';
import { PermissionKey } from '@/lib/auth/permissions';

interface PermissionGateProps {
  permission: PermissionKey;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * PermissionGate — renders children only if the session has the required
 * permission (wildcard-aware). Guards both routes and in-page actions.
 */
export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const can = useCan();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function usePermissionGuard(): (p: PermissionKey) => boolean {
  return useCan();
}

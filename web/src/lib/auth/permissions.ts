/**
 * Frontend permission model — flat keys mirroring the backend permission matrix.
 * Used by the permission guard + navigation gating. Business module permissions
 * are declared here as the UI foundation; enforcement happens via PermissionGate.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  ASSET_VIEW: 'asset.view',
  ASSET_CREATE: 'asset.create',
  ASSET_UPDATE: 'asset.update',
  ASSET_DELETE: 'asset.delete',
  ASSET_ASSIGN: 'asset.assign',
  ASSET_TRANSFER: 'asset.transfer',
  ASSET_DISPOSE: 'asset.dispose',
  ASSET_ARCHIVE: 'asset.archive',
  LIFECYCLE_READ: 'lifecycle.read',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_APPROVE: 'inventory.approve',
  MOVEMENT_VIEW: 'movement.view',
  MOVEMENT_APPROVE: 'movement.approve',
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_APPROVE: 'maintenance.approve',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  ANALYTICS_VIEW: 'analytics.view',
  COMPLIANCE_VIEW: 'compliance.view',
  AUDIT_VIEW: 'audit.view',
  SEARCH_VIEW: 'search.view',
  ADMIN_USER: 'admin.user',
  ADMIN_ROLE: 'admin.role',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Wildcard-aware permission check: has([...permissions], 'asset.view') or 'asset.*' */
export function hasPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*') || permissions.includes('admin.*')) return true;
  if (permissions.includes(required)) return true;
  // wildcard section match, e.g. required 'asset.view' vs granted 'asset.*'
  const section = required.split('.')[0];
  return permissions.includes(`${section}.*`);
}

export function can(permissions: string[] | undefined, required: PermissionKey): boolean {
  return hasPermission(permissions, required);
}

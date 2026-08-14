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
  INVENTORY_EXECUTE: 'inventory.execute',
  INVENTORY_VERIFY: 'inventory.verify',
  INVENTORY_CLOSE: 'inventory.close',
  MOVEMENT_VIEW: 'movement.view',
  MOVEMENT_CREATE: 'movement.create',
  MOVEMENT_APPROVE: 'movement.approve',
  MOVEMENT_REJECT: 'movement.reject',
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_APPROVE: 'maintenance.approve',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  ANALYTICS_VIEW: 'analytics.view',
  COMPLIANCE_VIEW: 'compliance.view',
  AUDIT_VIEW: 'audit.view',
  EXPORT_AUDIT: 'export.audit',
  SEARCH_VIEW: 'search.view',
  ADMIN_USER: 'admin.user',
  ADMIN_ROLE: 'admin.role',
  // Master data (seeded in backend permission catalog)
  LOCATION_VIEW: 'location.view',
  LOCATION_CREATE: 'location.create',
  LOCATION_UPDATE: 'location.update',
  LOCATION_DELETE: 'location.delete',
  CATEGORY_VIEW: 'category.view',
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  STATUS_VIEW: 'status.view',
  STATUS_CREATE: 'status.create',
  STATUS_UPDATE: 'status.update',
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  NOTIFICATION_VIEW: 'notification.view',
  IMPORT_VIEW: 'import.view',
  SETTINGS_VIEW: 'settings.view',
  EXPORT_ASSETS: 'export.assets',
  EXPORT_MOVEMENTS: 'export.movements',
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

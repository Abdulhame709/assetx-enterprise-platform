/**
 * Navigation config — permission-driven sidebar structure.
 * Each item lists the modules it opens; the shell filters by permission.
 * Business module routes exist as placeholders only (no implementations yet).
 */
import {
  LayoutDashboard,
  Boxes,
  Box,
  ClipboardList,
  Wrench,
  ArrowLeftRight,
  FileText,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Search,
  Settings,
  MapPin,
  Tags,
  CircleDot,
  Users,
  Bell,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, PermissionKey } from './auth/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** any of these permissions grants visibility */
  permission: PermissionKey;
  section?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'nav.overview',
    items: [
      { label: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { label: 'nav.search', href: '/search', icon: Search, permission: PERMISSIONS.SEARCH_VIEW },
      { label: 'nav.notifications', href: '/notifications', icon: Bell, permission: PERMISSIONS.NOTIFICATION_VIEW },
    ],
  },
  {
    title: 'nav.operations',
    items: [
      { label: 'nav.assets', href: '/assets', icon: Boxes, permission: PERMISSIONS.ASSET_VIEW },
      { label: 'nav.inventory', href: '/inventory', icon: ClipboardList, permission: PERMISSIONS.INVENTORY_VIEW },
      { label: 'nav.maintenance', href: '/maintenance', icon: Wrench, permission: PERMISSIONS.MAINTENANCE_VIEW },
      { label: 'nav.movements', href: '/movements', icon: ArrowLeftRight, permission: PERMISSIONS.MOVEMENT_VIEW },
      { label: 'nav.importData', href: '/import-data', icon: Upload, permission: PERMISSIONS.ADMIN_ROLE },
    ],
  },
  {
    title: 'nav.masterData',
    items: [
      { label: 'nav.locations', href: '/locations', icon: MapPin, permission: PERMISSIONS.LOCATION_VIEW },
      { label: 'nav.assetTypes', href: '/asset-types', icon: Tags, permission: PERMISSIONS.CATEGORY_VIEW },
      { label: 'nav.models', href: '/models', icon: Box, permission: PERMISSIONS.MODEL_VIEW },
      { label: 'nav.statuses', href: '/statuses', icon: CircleDot, permission: PERMISSIONS.STATUS_VIEW },
      { label: 'nav.employees', href: '/employees', icon: Users, permission: PERMISSIONS.EMPLOYEE_VIEW },
    ],
  },
  {
    title: 'nav.insights',
    items: [
      { label: 'nav.reports', href: '/reports', icon: FileText, permission: PERMISSIONS.REPORT_VIEW },
      { label: 'nav.analytics', href: '/analytics', icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW },
      { label: 'nav.compliance', href: '/compliance', icon: ShieldCheck, permission: PERMISSIONS.COMPLIANCE_VIEW },
      { label: 'nav.audit', href: '/audit', icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
    ],
  },
  {
    title: 'nav.administration',
    items: [
      { label: 'nav.administrationPage', href: '/administration', icon: Settings, permission: PERMISSIONS.ADMIN_ROLE },
      { label: 'nav.settings', href: '/settings', icon: Settings, permission: PERMISSIONS.ADMIN_ROLE },
    ],
  },
];

export function visibleSections(has: (p: PermissionKey) => boolean): NavSection[] {
  return NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => has(i.permission)) }))
    .filter((section) => section.items.length > 0);
}

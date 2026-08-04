/**
 * Navigation config — permission-driven sidebar structure.
 * Each item lists the modules it opens; the shell filters by permission.
 * Business module routes exist as placeholders only (no implementations yet).
 */
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Wrench,
  ArrowLeftRight,
  FileText,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Search,
  Settings,
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
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { label: 'Search', href: '/search', icon: Search, permission: PERMISSIONS.SEARCH_VIEW },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Assets', href: '/assets', icon: Boxes, permission: PERMISSIONS.ASSET_VIEW },
      { label: 'Inventory', href: '/inventory', icon: ClipboardList, permission: PERMISSIONS.INVENTORY_VIEW },
      { label: 'Maintenance', href: '/maintenance', icon: Wrench, permission: PERMISSIONS.MAINTENANCE_VIEW },
      { label: 'Movements', href: '/movements', icon: ArrowLeftRight, permission: PERMISSIONS.MOVEMENT_VIEW },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: FileText, permission: PERMISSIONS.REPORT_VIEW },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW },
      { label: 'Compliance', href: '/compliance', icon: ShieldCheck, permission: PERMISSIONS.COMPLIANCE_VIEW },
      { label: 'Audit', href: '/audit', icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Administration', href: '/administration', icon: Settings, permission: PERMISSIONS.ADMIN_ROLE },
    ],
  },
];

export function visibleSections(has: (p: PermissionKey) => boolean): NavSection[] {
  return NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => has(i.permission)) }))
    .filter((section) => section.items.length > 0);
}

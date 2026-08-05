'use client';

import { Building2, Menu, Languages } from 'lucide-react';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';
import { TenantBadge } from './TenantBadge';
import { UserMenu } from './UserMenu';
import { Breadcrumbs, Crumb } from '@/components/ui/Breadcrumbs';
import { usePathname } from 'next/navigation';

interface TopbarProps {
  onMenu?: () => void;
}

/** Derive breadcrumb crumb from the current path (feature-aware). */
function useBreadcrumbs(): Crumb[] {
  const pathname = usePathname();
  const segs = pathname.split('/').filter(Boolean);
  const map: Record<string, string> = {
    dashboard: 'Dashboard', assets: 'Assets', inventory: 'Inventory',
    maintenance: 'Maintenance', movements: 'Movements', reports: 'Reports',
    analytics: 'Analytics', compliance: 'Compliance', audit: 'Audit',
    search: 'Search', administration: 'Administration',
  };
  const crumbs: Crumb[] = [{ label: 'Home', href: '/dashboard' }];
  let acc = '';
  segs.forEach((s) => {
    acc += `/${s}`;
    const label = map[s] ?? (s.length > 12 ? `${s.slice(0, 12)}…` : s);
    crumbs.push({ label, href: acc });
  });
  return crumbs;
}

/** Topbar — top navigation bar: menu toggle, tenant context, language, user menu. */
export function Topbar({ onMenu }: TopbarProps) {
  const { session } = useSession();
  const { locale, setLocale } = useI18n();
  const crumbs = useBreadcrumbs();
  const isCrumbable = crumbs.length > 1;

  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4">
      {onMenu && (
        <button className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label="Toggle navigation">
          <Menu className="h-5 w-5" />
        </button>
      )}

      {isCrumbable ? (
        <div className="min-w-0"><Breadcrumbs items={crumbs} /></div>
      ) : (
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Building2 className="h-4 w-4 text-ink-faint" />
          <span>{session?.tenant.name ?? 'Tenant'}</span>
          <TenantBadge code={session?.tenant.code} />
        </div>
      )}

      <div className="ms-auto flex items-center gap-1">
        <button
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
          aria-label="Toggle language"
          title={locale === 'en' ? 'العربية' : 'English'}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === 'en' ? 'عربي' : 'EN'}</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

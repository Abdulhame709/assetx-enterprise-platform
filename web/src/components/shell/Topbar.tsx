'use client';

import { Building2, Menu, Languages } from 'lucide-react';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';
import { TenantBadge } from './TenantBadge';
import { UserMenu } from './UserMenu';
import { Breadcrumbs, Crumb } from '@/components/ui/Breadcrumbs';
import { usePathname } from 'next/navigation';
import { useCrumbTitle } from '@/lib/crumb-title';

interface TopbarProps {
  onMenu?: () => void;
}

/** Derive breadcrumb crumb from the current path (feature-aware). */
function useBreadcrumbs(): Crumb[] {
  const pathname = usePathname();
  const { t } = useI18n();
  const entityTitle = useCrumbTitle();
  const segs = pathname.split('/').filter(Boolean);
  const map: Record<string, string> = {
    dashboard: 'nav.dashboard', assets: 'nav.assets', inventory: 'nav.inventory',
    maintenance: 'nav.maintenance', movements: 'nav.movements', reports: 'nav.reports',
    analytics: 'nav.analytics', compliance: 'nav.compliance', audit: 'nav.audit',
    search: 'nav.search', administration: 'nav.administrationPage', notifications: 'nav.notifications',
    employees: 'nav.employees', settings: 'nav.settings', 'import-data': 'nav.importData',
    locations: 'nav.locations', 'asset-types': 'nav.assetTypes', statuses: 'nav.statuses', models: 'nav.models',
  };
  const crumbs: Crumb[] = [{ label: t('common.home'), href: '/dashboard' }];
  let acc = '';
  segs.forEach((s, idx) => {
    acc += `/${s}`;
    // P2 fix UX-07: never leak raw entity ids into crumbs; known sections get
    // human labels, an id segment shows the page-published entity title when
    // the loaded data provides one (never invented — 'Details' otherwise).
    const isIdSegment = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);
    const label = map[s]
      ? t(map[s])
      : (isIdSegment
        ? (idx === segs.length - 1 && entityTitle ? entityTitle : t('common.details'))
        : s.length > 12 ? `${s.slice(0, 12)}…` : s);
    crumbs.push({ label, href: acc });
  });
  return crumbs;
}

/** Topbar — top navigation bar: menu toggle, tenant context, language, user menu. */
export function Topbar({ onMenu }: TopbarProps) {
  const { session } = useSession();
  const { locale, setLocale, t } = useI18n();
  const crumbs = useBreadcrumbs();
  const isCrumbable = crumbs.length > 1;

  return (
    <header className="print-hide flex h-[72px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:px-6">
      {onMenu && (
          <button className="min-h-10 min-w-10 rounded-lg p-2 text-ink-muted hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label={t('common.toggleNavigation')}>
          <Menu className="h-5 w-5" />
        </button>
      )}

      {isCrumbable ? (
        <div className="min-w-0"><Breadcrumbs items={crumbs} /></div>
      ) : (
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Building2 className="h-4 w-4 text-ink-faint" />
          <span>{session?.tenant.name ?? t('common.tenant')}</span>
          <TenantBadge code={session?.tenant.code} />
        </div>
      )}

      <div className="ms-auto flex items-center gap-1">
        <button
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          aria-label={t('common.toggleLanguage')}
          title={locale === 'en' ? t('common.arabic') : t('common.english')}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === 'en' ? 'عربي' : 'EN'}</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { visibleSections } from '@/lib/navigation';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';
import { useBranding } from '@/features/settings/branding';

/** Sidebar — permission-driven navigation on the dark sidebar surface. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, session } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const branding = useBranding();
  const sections = visibleSections(can);

  return (
    <aside className="flex h-full w-72 flex-col border-e border-sidebar-line bg-sidebar text-sidebar-ink">
      <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-line px-5">
        {branding?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 shadow-button" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg shadow-button">
            <Boxes className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <span className="block truncate text-base font-bold text-sidebar-ink">{branding?.organization_name || 'AssetX'}</span>
          <span className="block truncate text-[11px] font-medium text-sidebar-muted">{branding?.organization_name ? 'AssetX' : t('shell.tagline')}</span>
        </div>
      </div>

      <nav className="ax-sidebar-scroll flex-1 overflow-y-auto px-3 py-4" aria-label={t('common.mainNavigation')}>
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-semibold text-sidebar-muted">{t(section.title)}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                        active ? 'bg-sidebar-hover text-sidebar-ink' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink',
                      )}
                    >
                      {active && <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand" />}
                      <Icon className={cn('h-4 w-4 shrink-0', active && 'text-brand')} />
                      <span className="truncate">{t(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-line p-3">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-hover px-3 py-2">
          <Building2 className="h-4 w-4 shrink-0 text-sidebar-muted" />
          <span className="truncate text-xs font-medium text-sidebar-muted">{session?.tenant.name ?? t('common.tenant')}</span>
        </div>
      </div>
    </aside>
  );
}

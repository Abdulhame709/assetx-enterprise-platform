'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { visibleSections } from '@/lib/navigation';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';

/** Sidebar — permission-driven navigation. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, session } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const sections = visibleSections(can);

  return (
    <aside className="flex h-full w-72 flex-col border-e border-line bg-surface shadow-sm">
      <div className="flex h-[72px] items-center gap-3 border-b border-line px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
          <Boxes className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <span className="block text-lg font-bold tracking-tight text-ink">AssetX</span>
          <span className="block truncate text-[11px] font-medium text-ink-faint">Enterprise Asset Operations</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={t('common.mainNavigation')}>
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              {t(section.title)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-lg bg-surface-muted/70 px-3 py-2">
          <Building2 className="h-4 w-4 shrink-0 text-ink-faint" />
          <span className="truncate text-xs font-medium text-ink-muted">{session?.tenant.name ?? t('common.tenant')}</span>
        </div>
      </div>
    </aside>
  );
}

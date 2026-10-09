'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth/session-context';
import { Sidebar } from './Sidebar';
import { CrumbTitleProvider } from '@/lib/crumb-title';
import { Topbar } from './Topbar';
import { Spinner } from '@/components/ui/Button';
import { SkipLink } from '@/components/ui/SkipLink';
import { useI18n } from '@/lib/i18n';

/** AppShell — authenticated application layout: sidebar + topbar + content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface" aria-label={t('session.loading')}>
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4" dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-ink">{t('session.requiredTitle')}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t('session.requiredDescription')}</p>
          <Link href="/login" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/40">
            {t('session.openLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CrumbTitleProvider>
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <SkipLink />
      {/* Desktop sidebar */}
      <div className="print-hide hidden lg:block">
        <Sidebar />
      </div>
      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="print-hide fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 start-0">
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileNav(true)} />
        <main id="main-content" key={pathname} className="ax-workspace flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
    </CrumbTitleProvider>
  );
}

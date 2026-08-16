'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth/session-context';
import { Sidebar } from './Sidebar';
import { CrumbTitleProvider } from '@/lib/crumb-title';
import { Topbar } from './Topbar';
import { Spinner } from '@/components/ui/Button';
import { SkipLink } from '@/components/ui/SkipLink';

/** AppShell — authenticated application layout: sidebar + topbar + content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Spinner className="h-8 w-8 text-brand" />
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

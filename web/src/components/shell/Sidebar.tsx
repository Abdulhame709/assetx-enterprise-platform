'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes } from 'lucide-react';
import { cn } from '@/lib/cn';
import { visibleSections } from '@/lib/navigation';
import { useSession } from '@/lib/auth/session-context';

/** Sidebar — permission-driven navigation. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession();
  const pathname = usePathname();
  const sections = visibleSections(can);

  return (
    <aside className="flex h-full w-64 flex-col border-e border-line bg-surface">
      <div className="flex h-16 items-center gap-2 border-b border-line px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
          <Boxes className="h-4 w-4" />
        </span>
        <span className="text-lg font-semibold text-ink">AssetX</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {section.title}
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
                        'flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium',
                        active ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

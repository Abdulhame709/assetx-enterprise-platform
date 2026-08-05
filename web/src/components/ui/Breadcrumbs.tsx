'use client';

import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs — logical-prop aware, reflects the current dir. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { dir } = useI18n();
  const Separator = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="text-ink-muted hover:text-brand">{c.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-ink' : 'text-ink-muted'}>{c.label}</span>
              )}
              {!last && <Separator className="h-3.5 w-3.5 text-ink-faint" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

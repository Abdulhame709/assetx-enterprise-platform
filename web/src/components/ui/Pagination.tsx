'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { intlLocale } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

/** Page numbers to show: first, last, current ±1, with `null` marking a gap. */
export function pageWindow(page: number, totalPages: number): Array<number | null> {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

const cell = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-40';

/** Pagination — first/prev/numbered/next/last with direction-aware arrows. */
export function Pagination({
  page,
  totalPages,
  onChange,
  disabled,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const fmt = (n: number) => n.toLocaleString(intlLocale(locale));
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  return (
    <nav aria-label={t('table.pagination')} className={cn('flex items-center gap-1', className)}>
      <button type="button" className={cn(cell, 'text-ink-muted hover:bg-surface-muted')} disabled={disabled || atStart} onClick={() => onChange(1)} aria-label={t('table.first')} title={t('table.first')}>
        <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
      </button>
      <button type="button" className={cn(cell, 'text-ink-muted hover:bg-surface-muted')} disabled={disabled || atStart} onClick={() => onChange(page - 1)} aria-label={t('table.previous')} title={t('table.previous')}>
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      </button>
      <div className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, totalPages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="px-1 text-ink-faint" aria-hidden>…</span>
          ) : (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              aria-label={`${t('table.pageLabel')} ${fmt(n)}`}
              aria-current={n === page ? 'page' : undefined}
              className={cn(cell, n === page ? 'bg-brand text-brand-fg shadow-button' : 'text-ink-muted hover:bg-surface-muted hover:text-ink')}
            >
              {fmt(n)}
            </button>
          ),
        )}
      </div>
      <button type="button" className={cn(cell, 'text-ink-muted hover:bg-surface-muted')} disabled={disabled || atEnd} onClick={() => onChange(page + 1)} aria-label={t('table.next')} title={t('table.next')}>
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </button>
      <button type="button" className={cn(cell, 'text-ink-muted hover:bg-surface-muted')} disabled={disabled || atEnd} onClick={() => onChange(totalPages)} aria-label={t('table.last')} title={t('table.last')}>
        <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
      </button>
    </nav>
  );
}

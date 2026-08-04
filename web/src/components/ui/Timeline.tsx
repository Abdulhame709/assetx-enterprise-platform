import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BadgeTone } from './Badge';

export interface TimelineEntry {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  tone?: BadgeTone;
  description?: ReactNode;
  time?: string;
}

const dot: Record<BadgeTone, string> = {
  neutral: 'bg-ink-faint',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Timeline — vertical event/step timeline for asset lifecycle & audit history. */
export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-4 border-s border-line ps-5', className)}>
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn('absolute -start-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface', dot[e.tone ?? 'neutral'])}
            aria-hidden
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-ink">{e.title}</span>
            {e.meta && <span className="text-xs text-ink-faint">{e.meta}</span>}
            {e.time && <span className="ms-auto text-xs text-ink-faint">{e.time}</span>}
          </div>
          {e.description && <div className="mt-0.5 text-xs text-ink-muted">{e.description}</div>}
        </li>
      ))}
    </ol>
  );
}

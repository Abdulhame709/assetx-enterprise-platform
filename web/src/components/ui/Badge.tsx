import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

/** StatusIndicator — colored dot + label, for lifecycle/status display. */
export function StatusIndicator({ tone = 'neutral', label }: { tone?: BadgeTone; label: string }) {
  const dot: Record<BadgeTone, string> = {
    neutral: 'bg-ink-faint',
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={cn('h-2 w-2 rounded-full', dot[tone])} aria-hidden />
      {label}
    </span>
  );
}

/** LifecycleStateBadge — semantic badge for the 8 lifecycle states. */
export function LifecycleStateBadge({ state }: { state: string }) {
  const { label } = useI18n();
  const map: Record<string, BadgeTone> = {
    draft: 'neutral',
    registered: 'info',
    active: 'success',
    assigned: 'brand',
    in_maintenance: 'warning',
    transferred: 'info',
    disposed: 'danger',
    archived: 'neutral',
  };
  return <Badge tone={map[state] ?? 'neutral'}>{label(state)}</Badge>;
}

'use client';

import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'border-info/30 bg-info/10', icon: 'text-info', Icon: Info },
  success: { box: 'border-success/30 bg-success/10', icon: 'text-success', Icon: CheckCircle2 },
  warning: { box: 'border-warning/30 bg-warning/10', icon: 'text-warning', Icon: AlertTriangle },
  danger: { box: 'border-danger/30 bg-danger/10', icon: 'text-danger', Icon: OctagonAlert },
};

/** Alert — inline, persistent message. Danger/warning announce assertively. */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { box, icon, Icon } = tones[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border border-s-4 p-3 text-sm sm:p-4', box, tone === 'info' ? 'border-s-info' : tone === 'success' ? 'border-s-success' : tone === 'warning' ? 'border-s-warning' : 'border-s-danger', className)}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className="text-ink-muted">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.dismiss')}
          title={t('common.dismiss')}
          className="rounded-md p-1 text-ink-faint hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

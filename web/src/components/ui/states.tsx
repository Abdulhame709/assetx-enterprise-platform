import { RefreshCw, Inbox, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { useI18n } from '@/lib/i18n';

/** LoadingState — skeleton rows for tables/blocks. */
export function LoadingState({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 p-4" aria-busy="true" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-muted" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

/** EmptyState — friendly empty state with optional action. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t('states.emptyTitle');
  const resolvedDescription = description ?? t('states.emptyDescription');
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-8 ring-brand-soft/40">
        <Inbox className="h-7 w-7" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{resolvedTitle}</p>
      <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{resolvedDescription}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** ErrorState — inline error with retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger ring-8 ring-danger/5">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-1" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

import { RefreshCw, Inbox, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { useI18n } from '@/lib/i18n';

/** LoadingState — skeleton rows for tables/blocks. */
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-muted" />
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
      <Inbox className="h-10 w-10 text-ink-faint" aria-hidden />
      <p className="text-sm font-medium text-ink">{resolvedTitle}</p>
      <p className="max-w-xs text-xs text-ink-muted">{resolvedDescription}</p>
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
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-1" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

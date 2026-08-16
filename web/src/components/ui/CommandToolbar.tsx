import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/auth/session-context';
import type { PermissionKey } from '@/lib/auth/permissions';

export type CommandToolbarVariant = 'default' | 'primary' | 'danger' | 'ghost';

export interface CommandToolbarAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  permission?: PermissionKey;
  disabled?: boolean;
  loading?: boolean;
  variant?: CommandToolbarVariant;
  separated?: boolean;
  showLabel?: boolean;
}

interface CommandToolbarProps {
  actions: CommandToolbarAction[];
  label?: string;
  className?: string;
}

const variants: Record<CommandToolbarVariant, string> = {
  default: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  primary: 'bg-brand text-white hover:bg-brand-strong',
  danger: 'text-danger hover:bg-danger/10',
  ghost: 'text-ink-faint hover:bg-surface-muted hover:text-ink',
};

/**
 * Dense, permission-aware page commands inspired by desktop accounting toolbars.
 * Every action must provide a real click handler or route; there are no inert buttons.
 */
export function CommandToolbar({ actions, label = 'أوامر الصفحة', className }: CommandToolbarProps) {
  const { can } = useSession();
  const visibleActions = actions.filter((action) => !action.permission || can(action.permission));

  if (visibleActions.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        'flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-raised p-1.5 shadow-card',
        className,
      )}
    >
      {visibleActions.map((action) => {
        const Icon = action.icon;
        const commonClassName = cn(
          'group inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-40',
          variants[action.variant ?? 'default'],
          action.separated && 'ms-1 border-s border-line ps-2.5',
        );
        const content = (
          <>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className={cn(!action.showLabel && 'sr-only sm:not-sr-only')}>{action.label}</span>
          </>
        );

        if (action.href) {
          return (
            <Link
              key={action.id}
              href={action.href}
              aria-label={action.label}
              title={action.label}
              className={commonClassName}
              onClick={action.onClick}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={action.id}
            type="button"
            aria-label={action.label}
            title={action.label}
            disabled={action.disabled || action.loading || !action.onClick}
            className={commonClassName}
            onClick={action.onClick}
          >
            {action.loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden="true" />}
            {!action.loading && content}
            {action.loading && <span className="sr-only">جارٍ التنفيذ</span>}
          </button>
        );
      })}
    </div>
  );
}

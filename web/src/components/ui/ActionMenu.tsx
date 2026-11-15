'use client';

import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { useMenu } from './useMenu';

export interface ActionItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

/** ActionMenu — dropdown of row/card actions (ellipsis trigger). */
export function ActionMenu({ items, triggerLabel }: { items: ActionItem[]; triggerLabel?: string }) {
  const { t } = useI18n();
  const { open, setOpen, close, rootRef, triggerRef, menuRef, onTriggerKeyDown, onMenuKeyDown } = useMenu();

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-label={triggerLabel ?? t('common.actions')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="animate-modal-in absolute end-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-line bg-surface-overlay py-1 shadow-pop"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none',
                  item.tone === 'danger' ? 'text-danger' : 'text-ink',
                )}
                onClick={() => {
                  close();
                  item.onClick();
                }}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ActionItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

/** ActionMenu — dropdown of row/card actions (ellipsis trigger). */
export function ActionMenu({ items, triggerLabel = 'Actions' }: { items: ActionItem[]; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink"
        onClick={() => setOpen((v) => !v)}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-line bg-surface-overlay py-1 shadow-pop"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                role="menuitem"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted',
                  item.tone === 'danger' ? 'text-danger' : 'text-ink',
                )}
                onClick={() => {
                  setOpen(false);
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

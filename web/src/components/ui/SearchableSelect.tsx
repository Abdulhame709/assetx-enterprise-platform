'use client';

/**
 * SearchableSelect (Phase UX-1) — combobox for lookup fields (category,
 * location, employee, status). Keyboard navigable, accessible (role=listbox).
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder, clearable = true, disabled = false }: SearchableSelectProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('select.search');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        disabled={disabled}
        className={cn('ax-input flex items-center justify-between text-start', disabled && 'cursor-not-allowed opacity-60') }
      >
        <span className={selected ? 'text-ink' : 'text-ink-faint'}>{selected ? selected.label : resolvedPlaceholder}</span>
        <ChevronDown className="h-4 w-4 text-ink-faint" />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-pop">
          <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
            <Search className="h-4 w-4 text-ink-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              placeholder={t('select.search')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              aria-label={t('select.filterOptions')}
            />
          </div>
          <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
            {clearable && (
              <li
                role="option"
                aria-selected={value == null}
                className={cn('flex items-center justify-between px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted', highlight === 0 && 'bg-surface-muted')}
                onMouseDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); setQuery(''); }}
              >
                {t('select.clear')}
              </li>
            )}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-faint">{t('select.noOptions')}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={cn('cursor-pointer px-3 py-2 text-sm text-ink hover:bg-surface-muted', i === highlight && 'bg-surface-muted')}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

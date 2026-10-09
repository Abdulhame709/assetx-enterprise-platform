'use client';

/**
 * SearchableSelect — searchable combobox for lookup fields.
 * Supports pointer and keyboard selection while keeping the existing API.
 */
import { useEffect, useId, useRef, useState } from 'react';
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
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const optionCount = filtered.length + (clearable ? 1 : 0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const chooseHighlight = () => {
    if (!clearable && filtered.length === 0) return;
    if (clearable && highlight === 0) {
      onChange(null);
    } else {
      const index = clearable ? highlight - 1 : highlight;
      const option = filtered[index];
      if (option) onChange(option.value);
    }
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      return;
    }
    if (!optionCount) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, optionCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlight(optionCount - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseHighlight();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setHighlight(0); } }}
        disabled={disabled}
        className={cn('ax-input flex items-center justify-between text-start', disabled && 'cursor-not-allowed opacity-60')}
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
              onKeyDown={handleKeyDown}
              placeholder={t('select.search')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              aria-label={t('select.filterOptions')}
              aria-controls={listId}
              aria-activedescendant={`${listId}-option-${highlight}`}
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {clearable && (
              <li
                id={`${listId}-option-0`}
                role="option"
                aria-selected={value == null}
                className={cn('flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted', highlight === 0 && 'bg-surface-muted')}
                onMouseEnter={() => setHighlight(0)}
                onMouseDown={(e) => { e.preventDefault(); chooseHighlight(); }}
              >
                {t('select.clear')}
              </li>
            )}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-faint">{t('select.noOptions')}</li>}
            {filtered.map((o, i) => {
              const optionIndex = clearable ? i + 1 : i;
              return (
                <li
                  key={o.value}
                  id={`${listId}-option-${optionIndex}`}
                  role="option"
                  aria-selected={o.value === value}
                  className={cn('cursor-pointer px-3 py-2 text-sm text-ink hover:bg-surface-muted', optionIndex === highlight && 'bg-surface-muted')}
                  onMouseEnter={() => setHighlight(optionIndex)}
                  onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
                >
                  {o.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

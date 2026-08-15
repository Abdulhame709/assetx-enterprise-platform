'use client';

/**
 * EnterpriseTable (Phase UX-1) — high-capability data table.
 * Supports: server pagination, sorting, column visibility, bulk selection,
 * toolbar (search + export + actions), row actions, empty/loading/error states.
 * Keeps the existing DataTable's rendering contract; clients pass columns/rows.
 */
import { ReactNode, useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Columns3, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { TableSkeleton } from './Skeleton';
import { EmptyState, ErrorState } from './states';
import { useI18n } from '@/lib/i18n';

export interface EColumn<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  hideable?: boolean;
  width?: string;
  render?: (row: T) => ReactNode;
  /** optional accessor for client-side sorting when the value isn't row[key] */
  accessor?: (row: T) => string | number;
}

export interface ETableProps<T> {
  columns: EColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  // pagination
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;

  // sorting (client or server-driven via callback)
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;

  // bulk selection
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;

  // toolbar
  searchable?: boolean;
  searchValue?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  exportable?: boolean;
  onExport?: () => void;
  toolbarActions?: ReactNode;
  /** column visibility (local, uncontrolled unless passed) */
  defaultHiddenColumns?: string[];
  empty?: ReactNode;
  className?: string;
}

export function EnterpriseTable<T>({
  columns: allColumns, rows, rowKey, loading, error, onRetry,
  page = 1, pageSize = 20, total = rows.length, onPageChange,
  sortKey, sortDir, onSortChange,
  selectable, selectedKeys, onSelectionChange,
  searchable, searchValue, onSearch, searchPlaceholder,
  exportable, onExport, toolbarActions,
  defaultHiddenColumns = [], empty, className,
}: ETableProps<T>) {
  const { t, locale } = useI18n();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('table.search');
  // column visibility (uncontrolled internal set)
  const [hidden, setHidden] = useState<Set<string>>(new Set(defaultHiddenColumns));
  const columns = allColumns.filter((c) => !(c.hideable && hidden.has(c.key)));

  const visible = allColumns.filter((c) => c.hideable);
  const selectedSet = useMemo(() => new Set(selectedKeys ?? []), [selectedKeys]);

  const toggleRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectionChange(Array.from(next));
  };
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(rowKey(r)));
  const toggleAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    const keys = rows.map(rowKey);
    onSelectionChange(allSelected ? selectedKeys.filter((k) => !keys.includes(k)) : Array.from(new Set([...selectedKeys, ...keys])));
  };

  const toggleColumn = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Client-side sorting (allowed; no server-side sort in this scope).
  // Sorts a copy of rows by the active sortKey/dir when provided.
  const displayRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const col = columns.find((c) => c.key === sortKey);
    const accessor = col?.accessor;
    return [...rows].sort((a, b) => {
      const av = accessor ? accessor(a) : (a as Record<string, unknown>)[sortKey];
      const bv = accessor ? accessor(b) : (b as Record<string, unknown>)[sortKey];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const alignCls = { left: 'text-start', center: 'text-center', right: 'text-end' };

  return (
    <div className={cn('rounded-xl border border-line', className)}>
      {/* Toolbar */}
      {(searchable || exportable || toolbarActions || (selectable && onSelectionChange && selectedKeys && selectedKeys.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted/40 px-3 py-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={searchValue ?? ''}
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder={resolvedSearchPlaceholder}
                aria-label={resolvedSearchPlaceholder}
                className="ax-input w-full py-1.5 ps-8 sm:w-56"
              />
            </div>
          )}
          {selectable && selectedKeys && selectedKeys.length > 0 && (
            <span className="text-sm text-ink-muted">{selectedKeys.length.toLocaleString(locale)} {t('table.selected')}</span>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2 max-sm:w-full">
            {toolbarActions}
            {exportable && onExport && (
              <Button variant="secondary" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> {t('table.export')}
              </Button>
            )}
            {visible.length > 0 && (
              <div className="relative">
                <Button variant="secondary" size="sm" aria-label={t('table.toggleColumns')}>
                  <Columns3 className="h-3.5 w-3.5" /> {t('table.columns')}
                </Button>
                <ColumnMenu<T>
                  options={visible}
                  hidden={hidden}
                  onToggle={toggleColumn}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body states */}
      {loading ? (
        <TableSkeleton rows={Math.min(6, pageSize)} cols={columns.length} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : displayRows.length === 0 ? (
        empty ?? <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                {selectable && onSelectionChange && selectedKeys && (
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label={t('table.selectAll')} checked={allSelected} onChange={toggleAll} />
                  </th>
                )}
                {columns.map((c) => {
                  const active = sortKey === c.key;
                  const SortIcon = !c.sortable ? null : active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={c.key}
                      style={c.width ? { width: c.width } : undefined}
                      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn('px-3 py-2.5 font-semibold', alignCls[c.align ?? 'left'])}
                    >
                      {c.sortable ? (
                        <button
                          className="inline-flex items-center gap-1 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          onClick={() => {
                            if (!onSortChange) return;
                            const dir = active && sortDir === 'asc' ? 'desc' : 'asc';
                            onSortChange(c.key, dir);
                          }}
                        >
                          {c.header}
                          {SortIcon && <SortIcon className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayRows.map((row) => {
                const k = rowKey(row);
                const checked = selectedSet.has(k);
                return (
                  <tr key={k} className={cn('hover:bg-surface-muted/50', checked && 'bg-brand-soft/40')}>
                    {selectable && onSelectionChange && selectedKeys && (
                      <td className="px-3 py-2.5">
                        <input type="checkbox" aria-label={t('table.selectRow')} checked={checked} onChange={() => toggleRow(k)} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-3 py-2.5 text-ink', alignCls[c.align ?? 'left'])}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm">
          <span className="text-ink-muted">
            {page.toLocaleString(locale)} / {totalPages.toLocaleString(locale)} · {total.toLocaleString(locale)} {t('table.results')}
          </span>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t('table.previous')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label={t('table.next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnMenu<T>({ options, hidden, onToggle }: {
  options: EColumn<T>[];
  hidden: Set<string>;
  onToggle: (k: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-muted"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Columns3 className="h-3.5 w-3.5" /> {t('table.columns')}
      </button>
      {open && (
        <ul role="menu" className="absolute end-0 z-30 mt-1 min-w-[180px] rounded-xl border border-line bg-surface-overlay py-1 shadow-pop">
          {options.map((c) => (
            <li key={c.key}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-muted">
                <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => onToggle(c.key)} />
                {String(c.header)}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
